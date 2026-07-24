import { NextResponse } from "next/server";
import { canWriteConversationCommunication } from "@/lib/communication-permissions";
import { assertConversationAccess, maxVoiceBytes, maxVoiceSeconds } from "@/lib/voice";
import { requireUser } from "@/lib/session";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const conversation = await assertConversationAccess(id, user);
  if (!conversation) return NextResponse.json({ error: "沒有此聊天室權限。" }, { status: 403 });

  if (!(await canWriteConversationCommunication(user, conversation))) {
    return NextResponse.json({ error: "總經理目前僅保留觀看權限，部門對部門案件不開放新增語音。" }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    conversationId: conversation.id,
    maxDurationSeconds: maxVoiceSeconds,
    maxFileSizeBytes: maxVoiceBytes,
    mimeTypes: ["audio/mp4", "audio/aac", "audio/mpeg", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]
  });
}
