import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { sendPushForNotification } from "@/lib/push";
import { prisma } from "@/lib/prisma";
import { canManageSystem } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

function canSendWebPushTest(roleKey: string, canManage: boolean) {
  return canManage || roleKey === "GENERAL_MANAGER" || roleKey === "EXECUTIVE_ASSISTANT";
}

function containsBadJwtToken(value?: string | null) {
  return Boolean(value?.toLowerCase().includes("badjwttoken"));
}

function resubscribeResponse(message: string, reason: "bad_jwt_token" | "inactive_subscription" | "no_active_subscription") {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      message,
      needsResubscribe: true,
      resubscribeReason: reason
    },
    { status: 409 }
  );
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = (await request.json().catch(() => ({}))) as { targetUserId?: unknown };
  if (body.targetUserId !== undefined && typeof body.targetUserId !== "string") {
    return NextResponse.json({ ok: false, error: "測試對象格式不正確。" }, { status: 400 });
  }

  const targetUserId = body.targetUserId?.trim() || user.id;
  const isSelfTest = targetUserId === user.id;
  if (!isSelfTest && !canSendWebPushTest(user.roleKey, canManageSystem(user))) {
    return NextResponse.json({ ok: false, error: "沒有測試其他使用者 Web Push 的權限。" }, { status: 403 });
  }

  if (!isSelfTest) {
    const targetExists = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!targetExists) return NextResponse.json({ ok: false, error: "找不到測試對象。" }, { status: 404 });
  }

  const [activeSubscriptionCount, inactiveSubscriptionCount] = await Promise.all([
    prisma.pushSubscription.count({ where: { userId: targetUserId, isActive: true } }),
    prisma.pushSubscription.count({ where: { userId: targetUserId, isActive: false } })
  ]);

  if (activeSubscriptionCount === 0) {
    if (inactiveSubscriptionCount > 0) {
      return resubscribeResponse("舊推播訂閱已失效，請重新訂閱推播。", "inactive_subscription");
    }
    return resubscribeResponse("尚未有可用推播訂閱，請先重新訂閱推播。", "no_active_subscription");
  }

  const notification = await createNotification({
    userId: targetUserId,
    title: "JU數位管理測試通知",
    body: "這是一則 iPhone PWA Web Push 測試通知，請確認鎖定畫面與通知中心是否收到。",
    type: "TEST",
    priority: "HIGH",
    targetUrl: "/notifications",
    sourceType: "web_push_test",
    sourceId: String(Date.now()),
    dedupeKey: `web-push-test:${targetUserId}:${Date.now()}`
  });

  const result = await sendPushForNotification(notification.id);
  if ((result.sent ?? 0) === 0 && (result.failed ?? 0) > 0) {
    const latestFailure = await prisma.notificationLog.findFirst({
      where: { notificationId: notification.id, channel: "PUSH", status: "FAILED" },
      orderBy: { createdAt: "desc" },
      select: { errorMessage: true }
    });
    if (containsBadJwtToken(latestFailure?.errorMessage)) {
      return resubscribeResponse("舊推播憑證已失效，請重新訂閱推播。", "bad_jwt_token");
    }
    return NextResponse.json({ ok: false, error: "推播測試送出失敗，請重新檢查推播訂閱狀態。", result }, { status: 409 });
  }

  if ((result.sent ?? 0) === 0 && result.reason === "No active Web Push subscription") {
    return resubscribeResponse("尚未有可用推播訂閱，請先重新訂閱推播。", "no_active_subscription");
  }

  return NextResponse.json({
    ok: true,
    message: "測試通知已送出，請確認手機是否收到。",
    notificationId: notification.id,
    result
  });
}
