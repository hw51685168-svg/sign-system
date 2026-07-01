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
    body: maybeWebPushError.body ?? null,
    headers: maybeWebPushError.headers ?? null
  });
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

  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
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
          body: notification.body,
          icon: "/app-icon.svg",
          badge: "/app-icon.svg",
          priority: notification.priority,
          timestamp: Date.now(),
          tag: notification.dedupeKey,
          data: {
            url: `/api/notifications/${notification.id}/click`,
            notificationId: notification.id,
            targetUrl: notification.targetUrl,
            dedupeKey: notification.dedupeKey
          }
        })
      );
      sent += 1;
      await prisma.pushSubscription.update({
        where: { id: subscription.id },
        data: { lastSuccessAt: new Date(), isActive: true }
      });
      await prisma.notificationLog.create({
        data: {
          notificationId: notification.id,
          userId: notification.userId,
          channel: "PUSH",
          status: "SENT",
          sentAt: new Date(),
          responsePayload: JSON.stringify({ endpoint: subscription.endpoint, result: "Push sent" })
        }
      });
    } catch (error) {
      failed += 1;
      const deactivate = shouldDeactivateSubscription(error);
      await prisma.pushSubscription.update({
        where: { id: subscription.id },
        data: { lastFailedAt: new Date(), ...(deactivate ? { isActive: false } : {}) }
      });
      await prisma.notificationLog.create({
        data: {
          notificationId: notification.id,
          userId: notification.userId,
          channel: "PUSH",
          status: "FAILED",
          errorMessage: pushErrorDetails(error),
          responsePayload: JSON.stringify({ endpoint: subscription.endpoint, deactivated: deactivate })
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
