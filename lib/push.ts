import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:admin@huangxiang.local";

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function pushAvailable() {
  return Boolean(publicKey && privateKey);
}

function pushErrorDetails(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const maybeWebPushError = error as Error & { statusCode?: number; body?: string; headers?: unknown };
  return JSON.stringify({
    message: error.message,
    statusCode: maybeWebPushError.statusCode ?? null,
    body: maybeWebPushError.body ? maybeWebPushError.body.slice(0, 240) : null
  });
}

function endpointHost(endpoint: string) {
  try {
    return new URL(endpoint).host;
  } catch {
    return "invalid";
  }
}

function safePushBody(notification: { type: string; body: string }) {
  if (notification.type === "APPROVAL_COMMENT") return "\u4f60\u6709\u4e00\u7b46\u7c3d\u5448\u7559\u8a00\uff0c\u8acb\u9032\u5165 JU\u6578\u4f4d\u7ba1\u7406\u67e5\u770b\u3002";
  if (notification.type.startsWith("APPROVAL")) return "\u4f60\u6709\u4e00\u7b46\u7c3d\u5448\u901a\u77e5\uff0c\u8acb\u9032\u5165 JU\u6578\u4f4d\u7ba1\u7406\u67e5\u770b\u3002";
  if (notification.type.startsWith("TASK")) return "\u4f60\u6709\u4e00\u7b46\u4efb\u52d9\u901a\u77e5\uff0c\u8acb\u9032\u5165 JU\u6578\u4f4d\u7ba1\u7406\u67e5\u770b\u3002";
  if (notification.type === "TEST") return notification.body.slice(0, 80);
  return "\u4f60\u6709\u4e00\u7b46\u65b0\u901a\u77e5\uff0c\u8acb\u9032\u5165 JU\u6578\u4f4d\u7ba1\u7406\u67e5\u770b\u3002";
}
function shouldDeactivateSubscription(error: unknown) {
  const maybeWebPushError = error as { statusCode?: number; body?: string } | null;
  const statusCode = maybeWebPushError?.statusCode;
  const body = maybeWebPushError?.body ?? "";

  if (statusCode === 404 || statusCode === 410) return true;
  if (statusCode !== 400 && statusCode !== 403) return false;

  return [
    "BadJwtToken",
    "ExpiredProviderToken",
    "InvalidProviderToken",
    "UnauthorizedRegistration",
    "InvalidRegistration",
    "MismatchSenderId",
    "NotRegistered"
  ].some((reason) => body.includes(reason));
}

export async function sendPushForNotification(notificationId: string) {
  if (!pushAvailable()) return { sent: 0, failed: 0, reason: "VAPID keys not configured" };

  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) return { sent: 0, failed: 0, reason: "Notification not found" };

  const existingSuccess = await prisma.notificationLog.findFirst({
    where: { notificationId, channel: "PUSH", status: "SENT" }
  });
  if (existingSuccess) return { sent: 0, failed: 0, skipped: true, reason: "Push already sent" };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: notification.userId, isActive: true }
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, skipped: 1, reason: "No active Web Push subscription" };
  }

  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      const isUrgent = notification.priority === "URGENT" || notification.priority === "HIGH";
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        },
        JSON.stringify({
          title: notification.title,
          body: safePushBody(notification),
          icon: "/app-icon-192.png",
          badge: "/app-icon-192.png",
          priority: notification.priority,
          timestamp: Date.now(),
          tag: notification.dedupeKey,
          data: {
            url: `/api/notifications/${notification.id}/click`,
            notificationId: notification.id,
            targetUrl: notification.targetUrl,
            dedupeKey: notification.dedupeKey,
            platform: subscription.platform
          }
        }),
        {
          TTL: isUrgent ? 300 : 3600,
          urgency: isUrgent ? "high" : "normal"
        }
      );
      sent += 1;
      await prisma.pushSubscription.update({
        where: { id: subscription.id },
        data: { lastSuccessAt: new Date(), lastSeenAt: new Date(), lastFailedAt: null, lastFailureReason: null, isActive: true }
      });
      await prisma.notificationLog.create({
        data: {
          notificationId: notification.id,
          userId: notification.userId,
          channel: "PUSH",
          status: "SENT",
          sentAt: new Date(),
          responsePayload: JSON.stringify({ endpointHost: endpointHost(subscription.endpoint), platform: subscription.platform, result: "Push sent" })
        }
      });
    } catch (error) {
      failed += 1;
      const deactivate = shouldDeactivateSubscription(error);
      await prisma.pushSubscription.update({
        where: { id: subscription.id },
        data: {
          lastFailedAt: new Date(),
          lastFailureReason: pushErrorDetails(error).slice(0, 500),
          ...(deactivate ? { isActive: false } : {})
        }
      });
      await prisma.notificationLog.create({
        data: {
          notificationId: notification.id,
          userId: notification.userId,
          channel: "PUSH",
          status: "FAILED",
          errorMessage: pushErrorDetails(error),
          responsePayload: JSON.stringify({ endpointHost: endpointHost(subscription.endpoint), platform: subscription.platform, deactivated: deactivate })
        }
      });
    }
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: failed > 0 && sent === 0 ? { status: "FAILED", failedAt: new Date() } : { status: "SENT", sentAt: new Date(), deliveredAt: new Date() }
  });

  return { sent, failed };
}
