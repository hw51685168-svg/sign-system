import { NotificationPriority, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
  setTimeout(() => {
    sendPushForNotification(notificationId).catch((error) => {
      console.error("Auto push failed", error);
    });
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
