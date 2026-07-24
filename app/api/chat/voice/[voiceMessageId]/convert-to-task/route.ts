import { TaskPriority } from "@prisma/client";
import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { sendPushForNotification } from "@/lib/push";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { assertVoiceAccess, canConvertVoiceToTask, writeVoiceAudit } from "@/lib/voice";

export async function POST(request: Request, { params }: { params: Promise<{ voiceMessageId: string }> }) {
  const { voiceMessageId } = await params;
  const user = await requireUser();
  const voice = await assertVoiceAccess(voiceMessageId, user);
  if (!voice) return NextResponse.json({ error: "找不到語音或沒有權限。" }, { status: 404 });
  if (!canConvertVoiceToTask(user)) return NextResponse.json({ error: "沒有語音轉任務權限。" }, { status: 403 });

  const formData = await request.formData();
  const title = textValue(formData, "title") || `語音轉任務：${voice.manualSummary || voice.fileName}`;
  const ownerId = optionalTextValue(formData, "ownerId") || user.id;
  const departmentId = optionalTextValue(formData, "departmentId") || user.departmentId;
  const dueDate = optionalTextValue(formData, "dueDate");
  const priority = (optionalTextValue(formData, "priority") || "MEDIUM") as TaskPriority;

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title,
        content: [
          voice.manualSummary || "此任務由 Voice Message（語音留言）轉成。",
          `來源語音：${voice.id}`,
          `語音長度：${voice.durationSeconds} 秒`
        ].join("\n"),
        ownerId,
        creatorId: user.id,
        departmentId,
        dueDate: dueDate ? new Date(`${dueDate}T23:59:59+08:00`) : null,
        priority,
        sourceType: "voice_message",
        sourceId: voice.id,
        comments: { create: { authorId: user.id, content: "由語音留言轉成任務" } }
      }
    });
    await tx.voiceMessage.update({ where: { id: voice.id }, data: { convertedTaskId: created.id } });
    await tx.chatMessage.create({
      data: {
        conversationId: voice.conversationId,
        senderId: user.id,
        messageType: "SYSTEM",
        content: `此語音已轉成任務：${created.title}`,
        sourceType: "task",
        sourceId: created.id
      }
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "VOICE_CONVERT_TO_TASK",
        resourceType: "voice_message",
        resourceId: voice.id,
        metadata: JSON.stringify({ taskId: created.id })
      }
    });
    return created;
  });

  if (task.ownerId !== user.id) {
    const notification = await createNotification({
      userId: task.ownerId,
      title: "語音已轉成任務",
      body: task.title,
      type: "TASK_ASSIGNED",
      priority: task.priority === "URGENT" ? "URGENT" : task.priority === "HIGH" ? "HIGH" : "MEDIUM",
      targetUrl: `/tasks/${task.id}`,
      sourceType: "voice_message",
      sourceId: voice.id,
      dedupeKey: `voice:${voice.id}:task:${task.id}:owner`
    });
    await sendPushForNotification(notification.id);
  }
  await writeVoiceAudit({ actorId: user.id, action: "VOICE_CONVERT_TO_TASK_API", voiceMessageId: voice.id, request });
  return appRedirect(`/tasks/${task.id}`);
}
