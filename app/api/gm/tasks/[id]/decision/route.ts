import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { optionalTextValue, textValue } from "@/lib/form";
import { createNotification } from "@/lib/notifications";
import { revalidateGmTaskNavigation } from "@/lib/navigation-revalidate";
import { prisma } from "@/lib/prisma";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";

function requestMeta(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null,
    userAgent: request.headers.get("user-agent")
  };
}

function canDecideGmTask(user: { id: string; roleKey: string }, task: { creatorId: string }) {
  return ["GENERAL_MANAGER", "SYSTEM_ADMIN"].includes(user.roleKey) || task.creatorId === user.id;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const formData = await request.formData();
  const decision = textValue(formData, "decision");
  const note = optionalTextValue(formData, "note");

  const task = await prisma.task.findFirst({
    where: { id: id, sourceType: "gm_assignment" },
    include: { owner: true, creator: true }
  });

  if (!task) return NextResponse.json({ error: "找不到這筆總經理交辦任務。" }, { status: 404 });
  if (!canDecideGmTask(user, task)) return NextResponse.json({ error: "你沒有確認或退回這筆交辦任務的權限。" }, { status: 403 });
  if (task.status !== "WAITING_CONFIRMATION") {
    return NextResponse.json({ error: "這筆交辦尚未進入等待確認狀態，無法執行此動作。" }, { status: 409 });
  }
  if (decision !== "CONFIRM_CLOSE" && decision !== "RETURN_CONTINUE") {
    return NextResponse.json({ error: "交辦處理動作不正確。" }, { status: 400 });
  }
  if (decision === "RETURN_CONTINUE" && !note) {
    return NextResponse.json({ error: "退回續辦必須填寫原因，讓接收人知道要補什麼。" }, { status: 400 });
  }

  const nextStatus = decision === "CONFIRM_CLOSE" ? "COMPLETED" : "REJECTED";
  const actionLabel = decision === "CONFIRM_CLOSE" ? "確認結案" : "退回續辦";
  const meta = requestMeta(request);
  const eventId = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: {
        status: nextStatus,
        progress: decision === "CONFIRM_CLOSE" ? 100 : task.progress,
        comments: {
          create: {
            authorId: user.id,
            content: `${actionLabel}${note ? `：\n${note}` : "。"}`
          }
        }
      }
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: decision === "CONFIRM_CLOSE" ? "GM_TASK_CLOSE" : "GM_TASK_RETURN",
        resourceType: "task",
        resourceId: task.id,
        metadata: JSON.stringify({ decision, nextStatus, note }),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      }
    });

    const notifyUserIds = Array.from(new Set([task.ownerId, task.creatorId].filter((id) => id && id !== user.id)));
    await Promise.all(
      notifyUserIds.map((userId) =>
        createNotification(
          {
            userId,
            title: decision === "CONFIRM_CLOSE" ? "交辦任務已確認結案" : "交辦任務已退回續辦",
            body:
              decision === "CONFIRM_CLOSE"
                ? `${user.name} 已確認「${task.title}」結案。`
                : `${user.name} 將「${task.title}」退回續辦，請查看原因並補充處理。`,
            type: "TASK_STATUS",
            priority: decision === "CONFIRM_CLOSE" ? "MEDIUM" : "HIGH",
            targetUrl: `/gm/tasks?view=${decision === "CONFIRM_CLOSE" ? "completed" : "progress"}#task-${task.id}`,
            sourceType: "task",
            sourceId: task.id,
            dedupeKey: `gm-task:${task.id}:decision:${eventId}:${userId}`
          },
          tx
        )
      )
    );
  });

  revalidateGmTaskNavigation(task.id);
  return appRedirect(`/gm/tasks?view=${decision === "CONFIRM_CLOSE" ? "completed" : "progress"}#task-${task.id}`);
}
