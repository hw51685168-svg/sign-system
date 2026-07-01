import type { Notification, NotificationPriority, RoleKey, User } from "@prisma/client";
import { sendFallbackChannelsForNotification } from "@/lib/fallback-notifications";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { sendPushForNotification } from "@/lib/push";

type EscalationUser = User & {
  role: { key: RoleKey };
};

const managerRoleKeys: RoleKey[] = [
  "ADMIN_MANAGER",
  "ACCOUNTING_MANAGER",
  "DESIGN_MANAGER",
  "SOCIAL_MEDIA_MANAGER",
  "HR_MANAGER",
  "CONSTRUCTION_MANAGER",
  "MANAGER"
];

function minutesFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function thresholdMinutes(priority: NotificationPriority) {
  const map: Record<NotificationPriority, number> = {
    URGENT: minutesFromEnv("ESCALATION_URGENT_MINUTES", 15),
    HIGH: minutesFromEnv("ESCALATION_HIGH_MINUTES", 60),
    MEDIUM: minutesFromEnv("ESCALATION_MEDIUM_MINUTES", 1440),
    LOW: minutesFromEnv("ESCALATION_LOW_MINUTES", 0)
  };
  return map[priority];
}

function isDue(notification: Notification, now: Date) {
  if (notification.isRead || notification.status === "READ" || notification.status === "CLICKED") return false;
  if (notification.type === "NOTIFICATION_ESCALATION") return false;
  if (notification.priority === "LOW") return false;
  const threshold = thresholdMinutes(notification.priority);
  if (!threshold) return false;
  const baseTime = notification.sentAt ?? notification.deliveredAt ?? notification.createdAt;
  const elapsedMinutes = (now.getTime() - baseTime.getTime()) / 60000;
  return elapsedMinutes >= threshold * (notification.escalationLevel + 1);
}

async function findExecutiveFallback(excludeUserId: string) {
  return prisma.user.findFirst({
    where: {
      isActive: true,
      id: { not: excludeUserId },
      role: { key: { in: ["EXECUTIVE_ASSISTANT", "GENERAL_MANAGER", "SYSTEM_ADMIN"] } }
    },
    include: { role: true },
    orderBy: { role: { key: "asc" } }
  });
}

async function findEscalationTarget(user: EscalationUser, level: number) {
  if (level >= 1) return findExecutiveFallback(user.id);

  if (user.storeId) {
    const branchManager = await prisma.user.findFirst({
      where: {
        isActive: true,
        id: { not: user.id },
        storeId: user.storeId,
        role: { key: "BRANCH_MANAGER" }
      },
      include: { role: true }
    });
    if (branchManager) return branchManager;
  }

  if (user.departmentId) {
    const departmentManager = await prisma.user.findFirst({
      where: {
        isActive: true,
        id: { not: user.id },
        departmentId: user.departmentId,
        role: { key: { in: managerRoleKeys } }
      },
      include: { role: true }
    });
    if (departmentManager) return departmentManager;
  }

  return findExecutiveFallback(user.id);
}

export async function runNotificationEscalations(options: { dryRun?: boolean; limit?: number } = {}) {
  const now = new Date();
  const limit = options.limit ?? 80;
  const candidates = await prisma.notification.findMany({
    where: {
      isRead: false,
      priority: { in: ["URGENT", "HIGH", "MEDIUM"] },
      escalationLevel: { lt: 2 }
    },
    include: {
      user: { include: { role: true } }
    },
    orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
    take: Math.max(limit * 5, limit)
  });

  const due = candidates.filter((notification) => isDue(notification, now)).slice(0, limit);
  const results: Array<{ notificationId: string; escalated: boolean; toUserId?: string; reason?: string }> = [];

  for (const notification of due) {
    const target = await findEscalationTarget(notification.user, notification.escalationLevel);
    if (!target) {
      results.push({ notificationId: notification.id, escalated: false, reason: "找不到可升級通知對象" });
      continue;
    }

    const nextLevel = notification.escalationLevel + 1;
    const reason = `通知逾時未讀，自動升級第 ${nextLevel} 層`;
    if (options.dryRun) {
      results.push({ notificationId: notification.id, escalated: true, toUserId: target.id, reason });
      continue;
    }

    const escalatedNotification = await prisma.$transaction(async (tx) => {
      await tx.notification.update({
        where: { id: notification.id },
        data: { status: "ESCALATED", escalationLevel: nextLevel }
      });
      await tx.notificationEscalation.create({
        data: {
          notificationId: notification.id,
          fromUserId: notification.userId,
          toUserId: target.id,
          escalationReason: reason,
          status: "created"
        }
      });
      return createNotification(
        {
          userId: target.id,
          title: `通知升級：${notification.title}`,
          body: `${notification.user.name} 尚未讀取通知。原通知內容：${notification.body}`,
          type: "NOTIFICATION_ESCALATION",
          priority: notification.priority,
          targetUrl: notification.targetUrl,
          sourceType: "notification_escalation",
          sourceId: notification.id,
          dedupeKey: `notification:${notification.id}:escalation:${nextLevel}:${target.id}`
        },
        tx
      );
    });

    await sendPushForNotification(escalatedNotification.id);
    await sendFallbackChannelsForNotification(escalatedNotification.id, reason);
    results.push({ notificationId: notification.id, escalated: true, toUserId: target.id, reason });
  }

  return {
    checked: candidates.length,
    due: due.length,
    escalated: results.filter((item) => item.escalated).length,
    results
  };
}
