import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { optionalTextValue, textValue } from "@/lib/form";
import { createNotification } from "@/lib/notifications";
import { revalidateGmTaskNavigation } from "@/lib/navigation-revalidate";
import { prisma } from "@/lib/prisma";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { saveUploadedFiles } from "@/lib/uploads";

function requestMeta(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null,
    userAgent: request.headers.get("user-agent")
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const formData = await request.formData();
  const task = await prisma.task.findFirst({ where: { id: id, sourceType: "gm_assignment", ownerId: user.id } });
  if (!task) return NextResponse.json({ error: "找不到可回報的交辦任務，或你沒有權限。" }, { status: 404 });
  if (["COMPLETED", "CANCELLED"].includes(task.status)) {
    return NextResponse.json({ error: "這筆交辦任務已完成或取消，無法再回報。" }, { status: 409 });
  }

  const reportContent = textValue(formData, "reportContent");
  if (!reportContent) return NextResponse.json({ error: "請填寫回報內容。" }, { status: 400 });

  const uploads = await saveUploadedFiles(formData, "attachments");
  const intent = optionalTextValue(formData, "intent") === "progress" ? "progress" : "complete";
  const nextStatus = intent === "progress" ? "IN_PROGRESS" : "WAITING_CONFIRMATION";
  const reportLabel = intent === "progress" ? "處理回報" : "完成回報";
  const meta = requestMeta(request);
  const reportEventId = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: {
        status: nextStatus,
        reportContent,
        comments: { create: { authorId: user.id, content: `${reportLabel}：\n${reportContent}` } },
        attachments: { create: uploads.map((file) => ({ ...file, uploaderId: user.id })) }
      }
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "GM_TASK_REPORT",
        resourceType: "task",
        resourceId: task.id,
        metadata: JSON.stringify({ intent, nextStatus, reportContent }),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      }
    });

    const generalManagers = await tx.user.findMany({
      where: { isActive: true, role: { key: "GENERAL_MANAGER" } },
      select: { id: true }
    });
    const notifyUserIds = Array.from(
      new Set([task.creatorId, ...generalManagers.map((manager) => manager.id)].filter((id) => id && id !== user.id))
    );

    await Promise.all(
      notifyUserIds.map((userId) =>
        createNotification(
          {
            userId,
            title: intent === "progress" ? "交辦任務有新回報" : "交辦任務等待確認結案",
            body:
              intent === "progress"
                ? `${user.name} 回報了「${task.title}」的處理狀況。`
                : `${user.name} 回報「${task.title}」已完成，請總經理確認是否結案。`,
            type: "TASK_STATUS",
            priority: "HIGH",
            targetUrl: `/gm/tasks?view=${intent === "progress" ? "progress" : "reported"}#task-${task.id}`,
            sourceType: "task",
            sourceId: task.id,
            dedupeKey: `gm-task:${task.id}:report:${reportEventId}:${userId}`
          },
          tx
        )
      )
    );
  });

  revalidateGmTaskNavigation(task.id);
  return appRedirect(`/gm/tasks?view=${intent === "progress" ? "progress" : "reported"}#task-${task.id}`);
}
