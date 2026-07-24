import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { assertVoiceAccess, voiceFilePath, writeVoiceAudit } from "@/lib/voice";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

function parseRange(rangeHeader: string | null, size: number) {
  if (!rangeHeader) return null;
  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return "invalid" as const;

  const [, startText, endText] = match;
  let start: number;
  let end: number;

  if (!startText && endText) {
    const suffixLength = Number(endText);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return "invalid" as const;
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText ? Number(endText) : size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
    return "invalid" as const;
  }

  return { start, end: Math.min(end, size - 1) };
}

export async function GET(request: Request, { params }: { params: Promise<{ voiceMessageId: string }> }) {
  const { voiceMessageId } = await params;
  const user = await requireUser();
  const voice = await assertVoiceAccess(voiceMessageId, user);
  if (!voice || voice.isWithdrawn || voice.message.isDeleted) {
    return NextResponse.json({ error: "找不到語音或沒有權限。" }, { status: 404 });
  }

  const filePath = voiceFilePath(voice.storedFileName);
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    return NextResponse.json({ error: "語音檔案不存在或已無法讀取。" }, { status: 404 });
  }

  await writeVoiceAudit({ actorId: user.id, action: "VOICE_STREAM", voiceMessageId: voice.id, request });

  const size = fileStat.size;
  const contentType = voice.mimeType || "application/octet-stream";
  const baseHeaders = {
    "content-type": contentType,
    "cache-control": "private, no-store",
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff"
  };
  const range = parseRange(request.headers.get("range"), size);

  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: {
        ...baseHeaders,
        "content-range": `bytes */${size}`
      }
    });
  }

  if (range) {
    const stream = createReadStream(filePath, { start: range.start, end: range.end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "content-length": String(range.end - range.start + 1),
        "content-range": `bytes ${range.start}-${range.end}/${size}`
      }
    });
  }

  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      ...baseHeaders,
      "content-length": String(size)
    }
  });
}
