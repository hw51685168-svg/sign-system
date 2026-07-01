import { NextResponse } from "next/server";
import { revalidateNotificationNavigation } from "@/lib/navigation-revalidate";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireUser();
  const body = (await request.json().catch(() => ({}))) as { endpoint?: string };

  const where = body.endpoint
    ? { userId: user.id, endpoint: body.endpoint }
    : { userId: user.id };

  await prisma.pushSubscription.updateMany({
    where,
    data: { isActive: false, lastFailedAt: new Date() }
  });

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: { enablePush: false },
    create: { userId: user.id, enablePush: false }
  });

  revalidateNotificationNavigation();
  return NextResponse.json({ ok: true });
}
