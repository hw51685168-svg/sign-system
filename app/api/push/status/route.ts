import { NextResponse } from "next/server";
import type { PushSubscription } from "@prisma/client";
import { pushAvailable } from "@/lib/push";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

function deviceName(subscription: { browser: string | null; os: string | null; deviceType: string | null }) {
  return [subscription.browser ?? "Unknown Browser", subscription.os ?? "Unknown OS", subscription.deviceType ?? "unknown device"].join(" / ");
}

function serializeSubscription(subscription: PushSubscription | null) {
  if (!subscription) return null;
  return {
    id: subscription.id,
    endpoint: subscription.endpoint,
    deviceName: deviceName(subscription),
    browser: subscription.browser ?? "Unknown",
    os: subscription.os ?? "Unknown",
    deviceType: subscription.deviceType ?? "unknown",
    isActive: subscription.isActive,
    lastSuccessAt: subscription.lastSuccessAt,
    lastFailedAt: subscription.lastFailedAt,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt
  };
}

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const endpoint = url.searchParams.get("endpoint");

  const [currentSubscription, latestSubscription, preference, subscriptionCount, latestPushLog] = await Promise.all([
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
    })
  ]);

  return NextResponse.json({
    pushAvailable: pushAvailable(),
    activeSubscriptionCount: subscriptionCount,
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
    latestPushLog
  });
}
