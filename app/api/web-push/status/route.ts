import { NextResponse } from "next/server";
import { nativePushConfigured } from "@/lib/native-push";
import { pushAvailable } from "@/lib/push";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

function endpointPreview(endpoint: string) {
  try {
    const host = new URL(endpoint).host;
    return { endpointHost: host, endpointPreview: `${host}/...${endpoint.slice(-8)}` };
  } catch {
    return { endpointHost: "invalid", endpointPreview: `invalid/...${endpoint.slice(-8)}` };
  }
}

type ResubscribeReason = "bad_jwt_token" | "inactive_subscription" | "no_active_subscription" | "permission_denied" | "unknown" | null;

function containsBadJwtToken(value?: string | null) {
  return Boolean(value?.toLowerCase().includes("badjwttoken"));
}

export async function GET(request: Request) {
  const user = await requireUser();
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  const [currentSubscription, latestSubscription, activeCount, latestPushLog, latestNativeToken, activeNativeTokenCount] = await Promise.all([
    endpoint ? prisma.pushSubscription.findFirst({ where: { userId: user.id, endpoint } }) : null,
    prisma.pushSubscription.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
    prisma.pushSubscription.count({ where: { userId: user.id, isActive: true } }),
    prisma.notificationLog.findFirst({
      where: { userId: user.id, channel: "PUSH" },
      orderBy: { createdAt: "desc" },
      select: { status: true, errorMessage: true, sentAt: true, createdAt: true }
    }),
    prisma.nativeDeviceToken.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
    prisma.nativeDeviceToken.count({ where: { userId: user.id, isActive: true, provider: "fcm" } })
  ]);

  const serialize = (subscription: typeof latestSubscription) => {
    if (!subscription) return null;
    return {
      id: subscription.id,
      ...endpointPreview(subscription.endpoint),
      platform: subscription.platform,
      browser: subscription.browser,
      os: subscription.os,
      deviceType: subscription.deviceType,
      isActive: subscription.isActive,
      lastSeenAt: subscription.lastSeenAt,
      lastSuccessAt: subscription.lastSuccessAt,
      lastFailureAt: subscription.lastFailedAt,
      lastFailureReason: subscription.lastFailureReason ? subscription.lastFailureReason.slice(0, 160) : null,
      updatedAt: subscription.updatedAt
    };
  };

  const hasCurrentEndpoint = Boolean(endpoint);
  const noActiveSubscriptions = activeCount === 0;
  // A stale record from another device must not force this device to re-enroll.
  const latestFailureReason =
    currentSubscription?.lastFailureReason ??
    (noActiveSubscriptions ? latestSubscription?.lastFailureReason ?? latestPushLog?.errorMessage ?? null : null);
  const resubscribeReason: ResubscribeReason = containsBadJwtToken(latestFailureReason)
    ? "bad_jwt_token"
    : currentSubscription && !currentSubscription.isActive
      ? "inactive_subscription"
      : hasCurrentEndpoint && !currentSubscription
        ? "inactive_subscription"
        : noActiveSubscriptions && latestSubscription
          ? "no_active_subscription"
          : null;

  return NextResponse.json({
    ok: true,
    pushAvailable: pushAvailable(),
    nativePushConfigured: nativePushConfigured(),
    activeSubscriptionCount: activeCount,
    activeNativeTokenCount,
    needsResubscribe: Boolean(resubscribeReason),
    resubscribeReason,
    currentSubscription: serialize(currentSubscription),
    latestSubscription: serialize(latestSubscription),
    latestNativeToken: latestNativeToken
      ? {
          id: latestNativeToken.id,
          platform: latestNativeToken.platform,
          provider: latestNativeToken.provider,
          deviceModel: latestNativeToken.deviceModel,
          osVersion: latestNativeToken.osVersion,
          appVersion: latestNativeToken.appVersion,
          isActive: latestNativeToken.isActive,
          lastSuccessAt: latestNativeToken.lastSuccessAt,
          lastFailedAt: latestNativeToken.lastFailedAt,
          updatedAt: latestNativeToken.updatedAt
        }
      : null,
    latestPushLog: latestPushLog
      ? {
          status: latestPushLog.status,
          errorMessage: latestPushLog.errorMessage ? latestPushLog.errorMessage.slice(0, 160) : null,
          sentAt: latestPushLog.sentAt,
          createdAt: latestPushLog.createdAt
        }
      : null
  });
}
