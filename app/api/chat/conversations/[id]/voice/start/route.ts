import { NextResponse } from "next/server";
import { assertConversationAccess, maxVoiceBytes, maxVoiceSeconds } from "@/lib/voice";
import { requireUser } from "@/lib/session";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const conversation = await assertConversationAccess(params.id, user);
  if (!conversation) return NextResponse.json({ error: "沒有此聊天室權限。" }, { status: 403 });

  return NextResponse.json({
    ok: true,
    conversationId: conversation.id,
    maxDurationSeconds: maxVoiceSeconds,
    maxFileSizeBytes: maxVoiceBytes,
    mimeTypes: ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"]
  });
}
