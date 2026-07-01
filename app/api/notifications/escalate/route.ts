import { NextResponse } from "next/server";
import { runNotificationEscalations } from "@/lib/notification-escalations";
import { createNotification } from "@/lib/notifications";
import { canManageSystem, hasPermission } from "@/lib/rbac";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!canManageSystem(user) && !hasPermission(user, "notification.escalate")) {
    return NextResponse.json({ error: "權限不足，無法執行通知升級。" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const dryRun = formData?.get("dryRun") === "true";
  const result = await runNotificationEscalations({ dryRun });
  if (formData?.get("redirect") === "true") {
    await createNotification({
      userId: user.id,
      title: dryRun ? "通知升級預覽完成" : "通知升級已執行",
      body: `檢查 ${result.checked} 則，符合升級 ${result.due} 則，已升級 ${result.escalated} 則。`,
      type: "SYSTEM",
      priority: "MEDIUM",
      targetUrl: "/admin/notifications-test",
      sourceType: "notification_escalation",
      sourceId: String(Date.now()),
      dedupeKey: `notification-escalation-run:${user.id}:${Date.now()}`
    });
    return appRedirect("/admin/notifications-test");
  }
  return NextResponse.json(result);
}
