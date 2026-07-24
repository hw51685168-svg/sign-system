import { NextResponse } from "next/server";
import { revalidateNotificationNavigation } from "@/lib/navigation-revalidate";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

type NativePushRegisterPayload = {
  token?: string;
  platform?: string;
  provider?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
};

function clean(value: unknown, maxLength = 255) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : undefined;
}

export async function POST(request: Request) {
  const user = await requireUser();
  const payload = (await request.json().catch(() => ({}))) as NativePushRegisterPayload;
  const token = clean(payload.token, 4096);

  if (!token) {
    return NextResponse.json({ error: "缺少裝置推播 token" }, { status: 400 });
  }

  const platform = clean(payload.platform, 50) || "android";
  const provider = clean(payload.provider, 50) || "fcm";

  const nativeToken = await prisma.nativeDeviceToken.upsert({
    where: { token },
    update: {
      userId: user.id,
      platform,
      provider,
      deviceModel: clean(payload.deviceModel),
      osVersion: clean(payload.osVersion),
      appVersion: clean(payload.appVersion),
      userAgent: request.headers.get("user-agent"),
      isActive: true,
      lastFailedAt: null
    },
    create: {
      userId: user.id,
      token,
      platform,
      provider,
      deviceModel: clean(payload.deviceModel),
      osVersion: clean(payload.osVersion),
      appVersion: clean(payload.appVersion),
      userAgent: request.headers.get("user-agent")
    }
  });

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: { enablePush: true },
    create: { userId: user.id, enablePush: true }
  });

  revalidateNotificationNavigation();
  return NextResponse.json({
    ok: true,
    id: nativeToken.id,
    provider: nativeToken.provider,
    platform: nativeToken.platform,
    isActive: nativeToken.isActive,
    updatedAt: nativeToken.updatedAt
  });
}
