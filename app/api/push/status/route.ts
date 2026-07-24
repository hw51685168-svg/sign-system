import { NextResponse } from "next/server";
import type { NativeDeviceToken, PushSubscription } from "@prisma/client";
import { nativePushConfigured } from "@/lib/native-push";
import { pushAvailable } from "@/lib/push";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

function deviceName(subscription: { browser: string | null; os: string | null; deviceType: string | null }) {
  return [subscription.browser ?? "Unknown Browser", subscription.os ?? "Unknown OS", subscription.deviceType ?? "unknown device"].join(" / ");
}

function serializeSubscription(subscription: PushSubscription | null) {
  if (!subscription) return null;
  let endpointHost = "unknown";
  try {
    endpointHost = new URL(subscription.endpoint).host;
  } catch {
    endpointHost = "invalid";
  }
  return {
    id: subscription.id,
    endpointHost,
    endpointPreview: `${endpointHost}/...${subscription.endpoint.slice(-8)}`,
    platform: subscription.platform,
    deviceName: deviceName(subscription),
    browser: subscription.browser ?? "Unknown",
    os: subscription.os ?? "Unknown",
    deviceType: subscription.deviceType ?? "unknown",
    isActive: subscription.isActive,
    lastSeenAt: subscription.lastSeenAt,
    lastSuccessAt: subscription.lastSuccessAt,
    lastFailedAt: subscription.lastFailedAt,
    lastFailureReason: subscription.lastFailureReason,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt
  };
}

function serializeNativeToken(token: NativeDeviceToken | null) {
  if (!token) return null;
  return {
    id: token.id,
    platform: token.platform,
    provider: token.provider,
    deviceModel: token.deviceModel,
    osVersion: token.osVersion,
    appVersion: token.appVersion,
    isActive: token.isActive,
    lastSuccessAt: token.lastSuccessAt,
    lastFailedAt: token.lastFailedAt,
    createdAt: token.createdAt,
    updatedAt: token.updatedAt
  };
}

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const endpoint = url.searchParams.get("endpoint");

  const [currentSubscription, latestSubscription, preference, subscriptionCount, latestPushLog, latestNativeToken, nativeTokenCount] = await Promise.all([
    endpoint
      ? prisma.pushSubscription.findFirst({
          where: { userId: user.id, endpoint }
        })
      : null,
    prisma.pushSubscription.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.notificationPreference.findUnique({ where: { userId: user.id } }),
    prisma.pushSubscription.count({ where: { userId: user.id, isActive: true } }),
    prisma.notificationLog.findFirst({
      where: { userId: user.id, channel: "PUSH" },
      orderBy: { createdAt: "desc" },
      select: { status: true, errorMessage: true, createdAt: true }
    }),
    prisma.nativeDeviceToken.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.nativeDeviceToken.count({ where: { userId: user.id, isActive: true, provider: "fcm" } })
  ]);

  return NextResponse.json({
    pushAvailable: pushAvailable(),
    nativePushConfigured: nativePushConfigured(),
    activeSubscriptionCount: subscriptionCount,
    activeNativeTokenCount: nativeTokenCount,
    preference: preference
      ? {
          enablePush: preference.enablePush,
          notifyP0: preference.notifyP0,
          notifyP1: preference.notifyP1,
          notifyP2: preference.notifyP2,
          notifyP3: preference.notifyP3
        }
      : null,
    currentSubscription: serializeSubscription(currentSubscription),
    latestSubscription: serializeSubscription(latestSubscription),
    latestNativeToken: serializeNativeToken(latestNativeToken),
    latestPushLog
  });
}
