import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function GET() {
  const user = await requireUser();
  const where = { userId: user.id, isRead: false };
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        body: true,
        priority: true,
        targetUrl: true,
        createdAt: true
      }
    }),
    prisma.notification.count({ where })
  ]);

  return NextResponse.json({
    unreadCount,
    notifications: notifications.map((notification) => ({
      ...notification,
      clickUrl: `/api/notifications/${notification.id}/click`
    }))
  });
}
