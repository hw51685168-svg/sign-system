import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { assertVoiceAccess, conversationTargetUrl, writeVoiceAudit } from "@/lib/voice";

export async function POST(request: Request, { params }: { params: { voiceMessageId: string } }) {
  const user = await requireUser();
  const voice = await assertVoiceAccess(params.voiceMessageId, user);
  if (!voice) return NextResponse.json({ error: "找不到語音或沒有權限。" }, { status: 404 });
  if (voice.senderId !== user.id && user.roleKey !== "SYSTEM_ADMIN" && user.roleKey !== "GENERAL_MANAGER") {
    return NextResponse.json({ error: "只有發送者、總經理或系統管理員可以撤回語音。" }, { status: 403 });
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
  await writeVoiceAudit({ actorId: user.id, action: "VOICE_WITHDRAW_FORM", voiceMessageId: voice.id, request });
  return appRedirect(conversationTargetUrl(voice.conversation));
}
