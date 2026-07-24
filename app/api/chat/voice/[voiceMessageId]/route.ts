import { NextResponse } from "next/server";
import { assertVoiceAccess, conversationTargetUrl, writeVoiceAudit } from "@/lib/voice";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function GET(request: Request, { params }: { params: Promise<{ voiceMessageId: string }> }) {
  const { voiceMessageId } = await params;
  const user = await requireUser();
  const voice = await assertVoiceAccess(voiceMessageId, user);
  if (!voice || voice.isWithdrawn || voice.message.isDeleted) {
    return NextResponse.json({ error: "找不到語音或沒有權限。" }, { status: 404 });
  }

  return NextResponse.json({
    id: voice.id,
    senderName: voice.sender.name,
    senderDepartment: voice.sender.department?.name ?? null,
    durationSeconds: voice.durationSeconds,
    fileSize: voice.fileSize,
    mimeType: voice.mimeType,
    manualSummary: voice.manualSummary,
    transcriptionStatus: voice.transcriptionStatus,
    transcriptionText: voice.transcriptionText,
    streamUrl: `/api/chat/voice/${voice.id}/stream`,
    targetUrl: conversationTargetUrl(voice.conversation, voice.id),
    listens: voice.listens.length,
    completedListens: voice.listens.filter((listen) => listen.completedAt).length
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ voiceMessageId: string }> }) {
  const { voiceMessageId } = await params;
  const user = await requireUser();
  const voice = await assertVoiceAccess(voiceMessageId, user);
  if (!voice) return NextResponse.json({ error: "找不到語音或沒有權限。" }, { status: 404 });
  if (voice.senderId !== user.id && user.roleKey !== "SYSTEM_ADMIN" && user.roleKey !== "GENERAL_MANAGER") {
    return NextResponse.json({ error: "只有發送者或管理層可以撤回語音。" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.voiceMessage.update({ where: { id: voice.id }, data: { isWithdrawn: true } });
    await tx.chatMessage.update({ where: { id: voice.messageId }, data: { isDeleted: true, deletedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "VOICE_WITHDRAW",
        resourceType: "voice_message",
        resourceId: voice.id,
        metadata: JSON.stringify({ conversationId: voice.conversationId })
      }
    });
  });
  await writeVoiceAudit({ actorId: user.id, action: "VOICE_DELETE_API", voiceMessageId: voice.id, request });
  return NextResponse.json({ ok: true });
}
