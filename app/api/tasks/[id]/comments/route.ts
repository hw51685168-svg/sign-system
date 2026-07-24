import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { canWriteTaskCommunication } from "@/lib/communication-permissions";
import { createNotification } from "@/lib/notifications";
import { revalidateGmTaskNavigation } from "@/lib/navigation-revalidate";
import { prisma } from "@/lib/prisma";
import { appRedirect } from "@/lib/redirect";
import { scopedTaskWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { demoMode } from "@/lib/demo";

function cleanComment(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function safeReturnTo(value: string | null, fallback: string) {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const formData = await request.formData();
  const returnTo = safeReturnTo(optionalTextValue(formData, "returnTo"), `/tasks/${id}`);
  if (demoMode) return appRedirect(returnTo);

  const content = cleanComment(textValue(formData, "content"));

  if (!content) {
    return NextResponse.json({ error: "回覆內容不可空白。" }, { status: 400 });
  }

  if (content.length > 1000) {
    return NextResponse.json({ error: "回覆內容最多 1000 字，請精簡後再送出。" }, { status: 400 });
  }

  const task = await prisma.task.findFirst({
    where: { AND: [{ id: id }, scopedTaskWhere(user)] },
    include: {
      owner: true,
      creator: true,
      assistants: { include: { user: true } }
    }
  });

  if (!task) {
    const exists = await prisma.task.count({ where: { id: id } });
    return NextResponse.json({ error: exists ? "權限不足，無法回覆這筆任務。" : "找不到任務。" }, { status: exists ? 403 : 404 });
  }

  if (!canWriteTaskCommunication(user, task)) {
    return NextResponse.json({ error: "只有交辦人、承辦人、協助人或管理者可以在此任務留言。" }, { status: 403 });
  }

  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
  const userAgent = request.headers.get("user-agent");

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.taskComment.create({
      data: {
        taskId: task.id,
        authorId: user.id,
        content
      }
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "TASK_COMMENT_CREATE",
        resourceType: "task",
        resourceId: task.id,
        metadata: JSON.stringify({ taskTitle: task.title, commentId: created.id }),
        ipAddress,
        userAgent
      }
    });

    const generalManagers =
      task.sourceType === "gm_assignment"
        ? await tx.user.findMany({
            where: { isActive: true, role: { key: "GENERAL_MANAGER" } },
            select: { id: true }
          })
        : [];
    const notifyUserIds = Array.from(
      new Set(
        [
          task.ownerId,
          task.creatorId,
          ...task.assistants.map((item) => item.userId),
          ...generalManagers.map((manager) => manager.id)
        ].filter((id) => id && id !== user.id)
      )
    );

    await Promise.all(
      notifyUserIds.map((userId) =>
        createNotification(
          {
            userId,
            title: "任務有新回覆",
            body: `${user.name} 回覆了任務：${task.title}`,
            type: "TASK_COMMENT",
            priority: "MEDIUM",
            targetUrl: task.sourceType === "gm_assignment" ? `/gm/tasks#task-${task.id}` : `/tasks/${task.id}`,
            sourceType: "task",
            sourceId: task.id,
            dedupeKey: `task:${task.id}:comment:${created.id}:${userId}`
          },
          tx
        )
      )
    );

    return created;
  });

  revalidateGmTaskNavigation(task.id);
  return appRedirect(returnTo.includes("#") ? returnTo : `${returnTo}#comment-${comment.id}`);
}
