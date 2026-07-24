import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { canWriteConversationCommunication } from "@/lib/communication-permissions";
import { prisma } from "@/lib/prisma";
import { assertConversationAccess, conversationTargetUrl, maxVoiceBytes, maxVoiceSeconds, notifyVoiceRecipients, saveVoiceFile, writeVoiceAudit } from "@/lib/voice";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const conversation = await assertConversationAccess(id, user);
  if (!conversation) return NextResponse.json({ error: "沒有此聊天室權限。" }, { status: 403 });

  if (!(await canWriteConversationCommunication(user, conversation))) {
    return NextResponse.json({ error: "總經理目前僅保留觀看權限，部門對部門案件不開放新增語音。" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("voice");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "請先錄音再送出。" }, { status: 400 });
  }
  if (!file.type.startsWith("audio/")) {
    return NextResponse.json({ error: "檔案格式不是音訊。" }, { status: 400 });
  }
  if (file.size > maxVoiceBytes) {
    return NextResponse.json({ error: "語音檔案超過 10MB 上限。" }, { status: 413 });
  }

  const durationSeconds = Math.max(1, Math.round(Number(textValue(formData, "durationSeconds") || "0")));
  if (durationSeconds > maxVoiceSeconds + 2) {
    return NextResponse.json({ error: "語音超過 120 秒上限。" }, { status: 400 });
  }

  const manualSummary = optionalTextValue(formData, "manualSummary");
  const priority = textValue(formData, "priority") === "URGENT" ? "URGENT" : "MEDIUM";
  const waveformRaw = optionalTextValue(formData, "waveformPeaks");
  let waveformPeaks = undefined;
  if (waveformRaw) {
    try {
      waveformPeaks = JSON.parse(waveformRaw);
    } catch {
      waveformPeaks = undefined;
    }
  }
  const saved = await saveVoiceFile(file);

  const created = await prisma.$transaction(async (tx) => {
    const message = await tx.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: user.id,
        messageType: "VOICE",
        content: manualSummary,
        sourceType: conversation.sourceType,
        sourceId: conversation.sourceId
      }
    });
    const voice = await tx.voiceMessage.create({
      data: {
        messageId: message.id,
        conversationId: conversation.id,
        senderId: user.id,
        fileUrl: `/api/chat/voice/pending/stream`,
        storedFileName: saved.storedFileName,
        fileName: file.name || "voice-message.webm",
        mimeType: file.type || "audio/webm",
        fileSize: saved.size,
        durationSeconds,
        waveformPeaks,
        manualSummary,
        sourceType: conversation.sourceType,
        sourceId: conversation.sourceId
      }
    });
    const updated = await tx.voiceMessage.update({
      where: { id: voice.id },
      data: { fileUrl: `/api/chat/voice/${voice.id}/stream` }
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "VOICE_SEND",
        resourceType: "voice_message",
        resourceId: voice.id,
        metadata: JSON.stringify({ conversationId: conversation.id, durationSeconds, fileSize: saved.size })
      }
    });
    return updated;
  });

  await notifyVoiceRecipients({
    conversation,
    voiceMessageId: created.id,
    senderId: user.id,
    senderName: user.name ?? "系統使用者",
    priority
  });
  await writeVoiceAudit({ actorId: user.id, action: "VOICE_NOTIFY", voiceMessageId: created.id, request });

  return NextResponse.json({
    ok: true,
    voiceMessageId: created.id,
    targetUrl: conversationTargetUrl(conversation, created.id),
    fileUrl: created.fileUrl
  });
}
