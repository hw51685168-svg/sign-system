import { TaskPriority } from "@prisma/client";
import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { sendPushForNotification } from "@/lib/push";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { assertVoiceAccess, canConvertVoiceToServiceRequest, writeVoiceAudit } from "@/lib/voice";

async function nextServiceNo() {
  const date = new Date();
  const code = date.toISOString().slice(0, 10).replace(/-/g, "");
  const count = await prisma.serviceRequest.count({ where: { requestNo: { startsWith: `SR-${code}` } } });
  return `SR-${code}-${String(count + 1).padStart(4, "0")}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ voiceMessageId: string }> }) {
  const { voiceMessageId } = await params;
  const user = await requireUser();
  const voice = await assertVoiceAccess(voiceMessageId, user);
  if (!voice) return NextResponse.json({ error: "找不到語音或沒有權限。" }, { status: 404 });
  if (!canConvertVoiceToServiceRequest(user)) return NextResponse.json({ error: "沒有語音轉服務需求權限。" }, { status: 403 });

  const formData = await request.formData();
  const responsibleDepartmentId = textValue(formData, "responsibleDepartmentId") || user.departmentId;
  if (!responsibleDepartmentId) return NextResponse.json({ error: "請指定負責部門。" }, { status: 400 });

  const title = textValue(formData, "title") || `語音轉服務需求：${voice.manualSummary || voice.fileName}`;
  const category = optionalTextValue(formData, "category") || "語音服務需求";
  const serviceName = optionalTextValue(formData, "serviceName") || "語音留言轉單";
  const ownerId = optionalTextValue(formData, "ownerId");
  const dueDate = optionalTextValue(formData, "dueDate");
  const priority = (optionalTextValue(formData, "priority") || "MEDIUM") as TaskPriority;

  const serviceRequest = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceRequest.create({
      data: {
        requestNo: await nextServiceNo(),
        title,
        category,
        serviceName,
        requesterId: user.id,
        requesterDepartmentId: user.departmentId,
        businessUnitId: user.businessUnitId,
        responsibleDepartmentId,
        storeId: user.storeId,
        ownerId,
        dueDate: dueDate ? new Date(`${dueDate}T23:59:59+08:00`) : null,
        priority,
        content: [
          voice.manualSummary || "此服務需求由 Voice Message（語音留言）轉成。",
          `來源語音：${voice.id}`,
          `語音長度：${voice.durationSeconds} 秒`
        ].join("\n"),
        sourceType: "voice_message",
        sourceId: voice.id,
        logs: { create: { actorId: user.id, action: "CREATE_FROM_VOICE", comment: "由語音留言轉成服務需求" } }
      }
    });
    await tx.voiceMessage.update({ where: { id: voice.id }, data: { convertedServiceRequestId: created.id } });
    await tx.chatMessage.create({
      data: {
        conversationId: voice.conversationId,
        senderId: user.id,
        messageType: "SYSTEM",
        content: `此語音已轉成服務需求：${created.title}`,
        sourceType: "service_request",
        sourceId: created.id
      }
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "VOICE_CONVERT_TO_SERVICE_REQUEST",
        resourceType: "voice_message",
        resourceId: voice.id,
        metadata: JSON.stringify({ serviceRequestId: created.id })
      }
    });
    return created;
  });

  const recipients = await prisma.user.findMany({ where: { isActive: true, departmentId: responsibleDepartmentId }, select: { id: true } });
  await Promise.all(
    recipients
      .filter((recipient) => recipient.id !== user.id)
      .map(async (recipient) => {
        const notification = await createNotification({
          userId: recipient.id,
          title: "語音已轉成服務需求",
          body: serviceRequest.title,
          type: "SERVICE_REQUEST",
          priority: priority === "URGENT" ? "URGENT" : priority === "HIGH" ? "HIGH" : "MEDIUM",
          targetUrl: `/services/requests/${serviceRequest.id}?tab=chat`,
          sourceType: "voice_message",
          sourceId: voice.id,
          dedupeKey: `voice:${voice.id}:service:${serviceRequest.id}:dept:${recipient.id}`
        });
        await sendPushForNotification(notification.id);
      })
  );
  await writeVoiceAudit({ actorId: user.id, action: "VOICE_CONVERT_TO_SERVICE_REQUEST_API", voiceMessageId: voice.id, request });
  return appRedirect(`/services/requests/${serviceRequest.id}?tab=chat`);
}
