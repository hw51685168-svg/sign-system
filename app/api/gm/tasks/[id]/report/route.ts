import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { createNotification } from "@/lib/notifications";
import { revalidateGmTaskNavigation } from "@/lib/navigation-revalidate";
import { prisma } from "@/lib/prisma";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { saveUploadedFiles } from "@/lib/uploads";

function progressValue(value: string) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function requestMeta(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null,
    userAgent: request.headers.get("user-agent")
  };
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const formData = await request.formData();
  const task = await prisma.task.findFirst({ where: { id: params.id, sourceType: "gm_assignment", ownerId: user.id } });
  if (!task) return NextResponse.json({ error: "找不到交辦任務，或你不是這筆任務的負責人。" }, { status: 404 });
  if (["COMPLETED", "CANCELLED"].includes(task.status)) {
    return NextResponse.json({ error: "此交辦任務已完成或取消，不能再回報進度。" }, { status: 409 });
  }

  const progress = progressValue(optionalTextValue(formData, "progress") ?? String(task.progress));
  const reportContent = textValue(formData, "reportContent");
  if (!reportContent) return NextResponse.json({ error: "請填寫進度回報內容。" }, { status: 400 });

  const uploads = await saveUploadedFiles(formData, "attachments");
  const nextStatus = progress >= 100 ? "WAITING_CONFIRMATION" : "IN_PROGRESS";
  const meta = requestMeta(request);

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: {
        status: nextStatus,
        progress,
        reportContent,
        comments: { create: { authorId: user.id, content: `進度回報：${progress}%\n${reportContent}` } },
        attachments: { create: uploads.map((file) => ({ ...file, uploaderId: user.id })) }
      }
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "GM_TASK_REPORT",
        resourceType: "task",
        resourceId: task.id,
        metadata: JSON.stringify({ progress, nextStatus, reportContent }),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      }
    });

    await createNotification(
      {
        userId: task.creatorId,
        title: "交辦任務已回報",
        body: `${task.title}：${progress}%`,
        type: "TASK_STATUS",
        priority: progress >= 100 ? "HIGH" : "MEDIUM",
        targetUrl: progress >= 100 ? "/gm/tasks?view=reported" : "/gm/tasks?view=progress",
        sourceType: "task",
        sourceId: task.id,
        dedupeKey: `gm-task:${task.id}:report:${user.id}:${progress}`
      },
      tx
    );
  });

  revalidateGmTaskNavigation(task.id);
  return appRedirect(progress >= 100 ? "/gm/tasks?view=reported" : "/gm/tasks?view=progress");
}
