import { NotificationPriority, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendNativePushForNotification } from "@/lib/native-push";
import { sendPushForNotification } from "@/lib/push";

export const notificationPriorityLabels: Record<NotificationPriority, string> = {
  URGENT: "P0 緊急",
  HIGH: "P1 重要",
  MEDIUM: "P2 一般",
  LOW: "P3 提醒"
};

export const notificationPriorityStyle: Record<NotificationPriority, { color: string; icon: string; className: string }> = {
  URGENT: { color: "red", icon: "alert", className: "border-red-200 bg-red-50 text-red-800" },
  HIGH: { color: "orange", icon: "warning", className: "border-orange-200 bg-orange-50 text-orange-800" },
  MEDIUM: { color: "blue", icon: "info", className: "border-sky-200 bg-sky-50 text-sky-800" },
  LOW: { color: "green", icon: "check", className: "border-emerald-200 bg-emerald-50 text-emerald-800" }
};

export type CreateNotificationInput = {
  userId: string;
  title: string;
  body: string;
  type: string;
  priority?: NotificationPriority;
  targetUrl: string;
  sourceType?: string;
  sourceId?: string;
  dedupeKey: string;
};

function queuePush(notificationId: string) {
  if (process.env.DISABLE_AUTO_PUSH === "true") return;
  const delayMs = Number(process.env.PUSH_DISPATCH_DELAY_MS ?? 900);
  setTimeout(async () => {
    const [webResult, nativeResult] = await Promise.all([
      sendPushForNotification(notificationId).catch((error) => {
        console.error("Auto web push failed", error);
        return { sent: 0, failed: 1, reason: error instanceof Error ? error.message : String(error) };
      }),
      sendNativePushForNotification(notificationId).catch((error) => {
        console.error("Auto native push failed", error);
        return { sent: 0, failed: 1, skipped: 0, reason: error instanceof Error ? error.message : String(error) };
      })
    ]);

    const webSent = Number(webResult.sent ?? 0);
    const nativeSent = Number(nativeResult.sent ?? 0);
    const webFailed = Number(webResult.failed ?? 0);
    const nativeFailed = Number(nativeResult.failed ?? 0);
    const webSkipped = Number((webResult as { skipped?: number }).skipped ?? 0);
    const nativeSkipped = Number(nativeResult.skipped ?? 0);

    if (webSent + nativeSent + webFailed + nativeFailed === 0 && webSkipped + nativeSkipped > 0) {
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { userId: true }
      });
      if (!notification) return;

      await prisma.notificationLog.create({
        data: {
          notificationId,
          userId: notification.userId,
          channel: "PUSH",
          status: "FAILED",
          errorMessage: "沒有有效背景推播通道。請到設定開啟 PWA Web Push；Android App 關閉或鎖定通知需完成 Firebase FCM 設定並註冊裝置 token。",
          responsePayload: JSON.stringify({
            web: webResult.reason ?? "No active Web Push subscription",
            native: nativeResult.reason ?? "No active Android FCM token"
          })
        }
      });
    }
  }, Number.isFinite(delayMs) ? delayMs : 900);
}

export async function createNotification(input: CreateNotificationInput, tx: Prisma.TransactionClient = prisma) {
  const priority = input.priority ?? "MEDIUM";
  const style = notificationPriorityStyle[priority];

  const notification = await tx.notification.upsert({
    where: {
      userId_dedupeKey: {
        userId: input.userId,
        dedupeKey: input.dedupeKey
      }
    },
    update: {},
    create: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type,
      priority,
      status: "SENT",
      color: style.color,
      icon: style.icon,
      targetUrl: input.targetUrl,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      dedupeKey: input.dedupeKey,
      deliveredAt: new Date(),
      sentAt: new Date(),
      logs: {
        create: {
          userId: input.userId,
          channel: "IN_APP",
          status: "SENT",
          sentAt: new Date()
        }
      }
    }
  });

  queuePush(notification.id);
  return notification;
}

export async function notifyUsers(userIds: string[], input: Omit<CreateNotificationInput, "userId">, tx: Prisma.TransactionClient = prisma) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  return Promise.all(uniqueUserIds.map((userId) => createNotification({ ...input, userId }, tx)));
}

export async function markNotificationRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date(), status: "READ" }
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date(), status: "READ" }
  });
}
