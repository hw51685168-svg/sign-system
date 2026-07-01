import { NextResponse } from "next/server";
import { assertVoiceAccess, writeVoiceAudit } from "@/lib/voice";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function POST(request: Request, { params }: { params: { voiceMessageId: string } }) {
  const user = await requireUser();
  const voice = await assertVoiceAccess(params.voiceMessageId, user);
  if (!voice || voice.isWithdrawn || voice.message.isDeleted) {
    return NextResponse.json({ error: "找不到語音或沒有權限。" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { positionSeconds?: number; completed?: boolean };
  const position = Math.max(0, Math.round(Number(body.positionSeconds || 0)));
  await prisma.voiceMessageListen.upsert({
    where: {
      voiceMessageId_userId: {
        voiceMessageId: voice.id,
        userId: user.id
      }
    },
    update: {
      lastPositionSeconds: position,
      completedAt: body.completed ? new Date() : undefined
    },
    create: {
      voiceMessageId: voice.id,
      userId: user.id,
      lastPositionSeconds: position,
      completedAt: body.completed ? new Date() : undefined
    }
  });
  await writeVoiceAudit({
    actorId: user.id,
    action: body.completed ? "VOICE_LISTEN_COMPLETED" : "VOICE_LISTEN_STARTED",
    voiceMessageId: voice.id,
    request,
    metadata: { position }
  });
  return NextResponse.json({ ok: true });
}
