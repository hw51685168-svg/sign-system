import { NextResponse } from "next/server";

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json({ ok: false, error: "Web Push VAPID public key is not configured." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, publicKey });
}
