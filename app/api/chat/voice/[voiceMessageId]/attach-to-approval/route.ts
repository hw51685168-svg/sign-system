import { NextResponse } from "next/server";
import { optionalTextValue } from "@/lib/form";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { sendPushForNotification } from "@/lib/push";
import { scopedApprovalWhere } from "@/lib/rbac";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { assertVoiceAccess, canAttachVoiceToApproval, writeVoiceAudit } from "@/lib/voice";

export async function POST(request: Request, { params }: { params: { voiceMessageId: string } }) {
  const user = await requireUser();
  const voice = await assertVoiceAccess(params.voiceMessageId, user);
  if (!voice) return NextResponse.json({ error: "找不到語音或沒有權限。" }, { status: 404 });
  if (!canAttachVoiceToApproval(user)) return NextResponse.json({ error: "沒有語音加入簽呈權限。" }, { status: 403 });

  const formData = await request.formData();
  const approvalId = optionalTextValue(formData, "approvalId") || (voice.conversation.type === "APPROVAL" ? voice.conversation.sourceId : null);
  if (!approvalId) return NextResponse.json({ error: "請指定簽呈。" }, { status: 400 });

  const approval = await prisma.approvalRequest.findFirst({
    where: { AND: [{ id: approvalId }, scopedApprovalWhere(user)] }
  });
  if (!approval) return NextResponse.json({ error: "找不到簽呈或沒有權限。" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.voiceMessage.update({ where: { id: voice.id }, data: { attachedApprovalId: approval.id } });
    await tx.approvalLog.create({
      data: {
        approvalRequestId: approval.id,
        actorId: user.id,
        action: "COMMENT",
        fromStatus: approval.status,
        toStatus: approval.status,
        comment: `加入 Voice Message（語音補充）：${voice.id}${voice.manualSummary ? `\n重點：${voice.manualSummary}` : ""}`
      }
    });
    await tx.chatMessage.create({
      data: {
        conversationId: voice.conversationId,
        senderId: user.id,
        messageType: "SYSTEM",
        content: `此語音已加入簽呈補充：${approval.requestNo}`,
        sourceType: "approval",
        sourceId: approval.id
      }
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "VOICE_ATTACH_TO_APPROVAL",
        resourceType: "voice_message",
        resourceId: voice.id,
        metadata: JSON.stringify({ approvalId: approval.id })
      }
    });
  });

  if (approval.applicantId !== user.id) {
    const notification = await createNotification({
      userId: approval.applicantId,
      title: "簽呈有新的語音補充",
      body: approval.subject,
      type: "APPROVAL_COMMENT",
      priority: "MEDIUM",
      targetUrl: `/approvals/${approval.id}?tab=chat#voice-${voice.id}`,
      sourceType: "voice_message",
      sourceId: voice.id,
      dedupeKey: `voice:${voice.id}:attach-approval:${approval.id}:applicant`
    });
    await sendPushForNotification(notification.id);
  }
  await writeVoiceAudit({ actorId: user.id, action: "VOICE_ATTACH_TO_APPROVAL_API", voiceMessageId: voice.id, request });
  return appRedirect(`/approvals/${approval.id}?tab=chat#voice-${voice.id}`);
}
