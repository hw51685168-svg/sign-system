import { NextResponse } from "next/server";
import { assertVoiceAccess, readVoiceFile, writeVoiceAudit } from "@/lib/voice";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: { voiceMessageId: string } }) {
  const user = await requireUser();
  const voice = await assertVoiceAccess(params.voiceMessageId, user);
  if (!voice || voice.isWithdrawn || voice.message.isDeleted) {
    return NextResponse.json({ error: "找不到語音或沒有權限。" }, { status: 404 });
  }

  const file = await readVoiceFile(voice.storedFileName);
  await writeVoiceAudit({ actorId: user.id, action: "VOICE_STREAM", voiceMessageId: voice.id, request });
  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": voice.mimeType,
      "content-length": String(file.length),
      "cache-control": "private, no-store",
      "accept-ranges": "bytes"
    }
  });
}
