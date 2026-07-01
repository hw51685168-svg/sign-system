import { PilotDeviceType, PilotSeverity } from "@prisma/client";
import { appRedirect } from "@/lib/redirect";
import { createNotification } from "@/lib/notifications";
import { canAccessPilot } from "@/lib/pilot";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

function score(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value)) return 3;
  return Math.min(Math.max(Math.round(value), 1), 5);
}

function bool(formData: FormData, key: string) {
  return String(formData.get(key) || "") === "on" || String(formData.get(key) || "") === "true";
}

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  return value.length > 0 ? value : null;
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!canAccessPilot(user)) {
    return new Response("你沒有送出主管實測回饋的權限。", { status: 403 });
  }

  const formData = await request.formData();
  const deviceType = String(formData.get("deviceType") || "DESKTOP") as PilotDeviceType;
  const priority = String(formData.get("priority") || "P2") as PilotSeverity;

  const feedback = await prisma.pilotFeedback.create({
    data: {
      testerId: user.id,
      roleName: user.roleName || user.roleKey,
      departmentOrStore: text(formData, "departmentOrStore") || user.storeName || user.departmentName || null,
      deviceType,
      easeScore: score(formData, "easeScore"),
      homeScore: score(formData, "homeScore"),
      taskScore: score(formData, "taskScore"),
      notificationScore: score(formData, "notificationScore"),
      voiceScore: score(formData, "voiceScore"),
      approvalScore: score(formData, "approvalScore"),
      stuckPoint: text(formData, "stuckPoint"),
      missingButton: text(formData, "missingButton"),
      smallText: text(formData, "smallText"),
      badFlow: text(formData, "badFlow"),
      receivedPush: bool(formData, "receivedPush"),
      recordedVoice: bool(formData, "recordedVoice"),
      playedVoice: bool(formData, "playedVoice"),
      hadError: bool(formData, "hadError"),
      suggestions: text(formData, "suggestions"),
      priority
    }
  });

  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { key: "SYSTEM_ADMIN" } },
    select: { id: true }
  });

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        title: "收到主管實測回饋",
        body: `${user.name} 已送出主管實測回饋，請到管理中心查看。`,
        type: "PILOT_FEEDBACK",
        priority: priority === "P0" ? "URGENT" : priority === "P1" ? "HIGH" : "MEDIUM",
        targetUrl: "/admin/pilot",
        sourceType: "pilot_feedback",
        sourceId: feedback.id,
        dedupeKey: `pilot-feedback:${feedback.id}:${admin.id}`
      })
    )
  );

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "PILOT_FEEDBACK_CREATE",
      resourceType: "PilotFeedback",
      resourceId: feedback.id,
      metadata: JSON.stringify({ priority, deviceType })
    }
  });

  return appRedirect("/pilot/feedback?submitted=1");
}
