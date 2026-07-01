import { TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { createNotification } from "@/lib/notifications";
import { revalidateGmTaskNavigation } from "@/lib/navigation-revalidate";
import { prisma } from "@/lib/prisma";
import { canApprove, scopedTaskWhere } from "@/lib/rbac";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { saveUploadedFiles } from "@/lib/uploads";
import { demoMode } from "@/lib/demo";

const terminalStatuses: TaskStatus[] = ["COMPLETED", "CANCELLED"];

function clampProgress(value: string) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (demoMode) return appRedirect(`/tasks/${params.id}`);
  const formData = await request.formData();

  const task = await prisma.task.findFirst({
    where: { AND: [{ id: params.id }, scopedTaskWhere(user)] },
    include: { owner: true, creator: true }
  });
  if (!task) {
    const exists = await prisma.task.count({ where: { id: params.id } });
    return NextResponse.json({ error: exists ? "權限不足，無法查看或更新此任務。" : "找不到任務。" }, { status: exists ? 403 : 404 });
  }

  const quickStatus = optionalTextValue(formData, "quickStatus");
  const requestedStatus = (quickStatus || textValue(formData, "status")) as TaskStatus;
  const progressSource = textValue(formData, "progressNumber") || textValue(formData, "progress") || String(task.progress);
  const progress = clampProgress(progressSource);
  const reportContent = optionalTextValue(formData, "reportContent");
  const uploads = await saveUploadedFiles(formData, "attachments");

  if (!Object.values(TaskStatus).includes(requestedStatus)) {
    return NextResponse.json({ error: "任務狀態不正確。" }, { status: 400 });
  }
  if (terminalStatuses.includes(task.status) && requestedStatus === task.status && !reportContent && uploads.length === 0) {
    return appRedirect(`/tasks/${task.id}`);
  }
  if (task.status === "COMPLETED" && requestedStatus !== "COMPLETED") {
    return NextResponse.json({ error: "已完成任務不可再次變更狀態。" }, { status: 409 });
  }
  if (requestedStatus === "REJECTED" && !reportContent) {
    return NextResponse.json({ error: "駁回或退回修改必須填寫原因。" }, { status: 400 });
  }
  if (["COMPLETED", "REJECTED"].includes(requestedStatus) && !canApprove(user)) {
    return NextResponse.json({ error: "只有主管可以通過或駁回任務。" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: {
        status: requestedStatus,
        progress: requestedStatus === "COMPLETED" ? 100 : progress,
        reportContent,
        comments: {
          create: {
            authorId: user.id,
            content: [
              `狀態：${task.status} → ${requestedStatus}`,
              `進度：${task.progress}% → ${requestedStatus === "COMPLETED" ? 100 : progress}%`,
              reportContent ? `回報：${reportContent}` : null
            ].filter(Boolean).join("\n")
          }
        },
        attachments: {
          create: uploads.map((file) => ({ ...file, uploaderId: user.id }))
        }
      }
    });

    const notifyUserIds = Array.from(new Set([task.ownerId, task.creatorId].filter((id) => id !== user.id)));
    await Promise.all(
      notifyUserIds.map((userId) =>
        createNotification(
          {
            userId,
            title: "任務狀態已更新",
            body: `${task.title} 已更新為 ${requestedStatus}。`,
            type: "TASK_STATUS",
            priority: requestedStatus === "REJECTED" ? "HIGH" : "MEDIUM",
            targetUrl: `/tasks/${task.id}`,
            sourceType: "task",
            sourceId: task.id,
            dedupeKey: `task:${task.id}:status:${requestedStatus}:${user.id}`
          },
          tx
        )
      )
    );
  });

  revalidateGmTaskNavigation(task.id);
  return appRedirect(`/tasks/${task.id}`);
}
