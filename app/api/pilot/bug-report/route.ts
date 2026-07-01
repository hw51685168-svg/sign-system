import { ErrorSeverity, PilotBugType, PilotSeverity } from "@prisma/client";
import { appRedirect } from "@/lib/redirect";
import { createOrUpdateErrorReport } from "@/lib/error-command-center";
import { sanitizeJson } from "@/lib/error-sanitizer";
import { createNotification } from "@/lib/notifications";
import { canAccessPilot } from "@/lib/pilot";
import { prisma } from "@/lib/prisma";
import { sendPushForNotification } from "@/lib/push";
import { requireUser } from "@/lib/session";
import { saveUploadedFiles } from "@/lib/uploads";

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
    return new Response("你沒有送出測試問題回報的權限。", { status: 403 });
  }

  const formData = await request.formData();
  const title = text(formData, "title");
  const description = text(formData, "description");
  if (!title || !description) {
    return new Response("問題標題與問題描述必填。", { status: 400 });
  }

  const screenshot = await saveUploadedFiles(formData, "screenshot");
  const severity = String(formData.get("severity") || "P2") as PilotSeverity;
  const pageUrl = text(formData, "pageUrl");
  const deviceType = text(formData, "deviceType") || "未填寫";
  const bug = await prisma.pilotBugReport.create({
    data: {
      reporterId: user.id,
      title,
      type: String(formData.get("type") || "OTHER") as PilotBugType,
      pageUrl,
      roleName: text(formData, "roleName") || user.roleName || user.roleKey,
      deviceType,
      description,
      screenshotFileUrl: screenshot[0]?.fileUrl ?? null,
      severity,
      blocksTesting: bool(formData, "blocksTesting")
    }
  });

  const errorResult = await createOrUpdateErrorReport(
    {
      severity: severity as ErrorSeverity,
      title,
      message: description,
      module: "pilot_bug_report",
      route: pageUrl || "/pilot/bug-report",
      action: "manual_bug_report",
      deviceType,
      context: {
        pilotBugReportId: bug.id,
        type: bug.type,
        blocksTesting: bug.blocksTesting,
        screenshotFileUrl: bug.screenshotFileUrl
      },
      breadcrumbs: [
        {
          type: "manual",
          label: "主管送出測試問題回報",
          route: pageUrl || "/pilot/bug-report",
          metadata: { pilotBugReportId: bug.id }
        }
      ]
    },
    user
  );

  if (screenshot[0]) {
    await prisma.errorAttachment.create({
      data: {
        errorReportId: errorResult.errorReport.id,
        fileUrl: screenshot[0].fileUrl,
        fileName: screenshot[0].fileName,
        mimeType: screenshot[0].mimeType,
        fileSize: screenshot[0].size,
        isScreenshot: true,
        isSanitized: true
      }
    });
  }

  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { key: "SYSTEM_ADMIN" } },
    select: { id: true }
  });

  const notifications = await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        title: severity === "P0" ? "P0 測試阻擋 Bug" : "收到測試問題回報",
        body: `${user.name} 回報：${title}`,
        type: "PILOT_BUG",
        priority: severity === "P0" ? "URGENT" : severity === "P1" ? "HIGH" : "MEDIUM",
        targetUrl: `/admin/errors/${errorResult.errorReport.id}`,
        sourceType: "pilot_bug",
        sourceId: bug.id,
        dedupeKey: `pilot-bug:${bug.id}:${admin.id}`
      })
    )
  );

  if (severity === "P0") {
    await Promise.all(notifications.map((notification) => sendPushForNotification(notification.id)));
  }

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "PILOT_BUG_CREATE",
      resourceType: "PilotBugReport",
      resourceId: bug.id,
      metadata: sanitizeJson({ severity, pageUrl: bug.pageUrl, blocksTesting: bug.blocksTesting, errorReportId: errorResult.errorReport.id })
    }
  });

  return appRedirect("/pilot/bug-report?submitted=1");
}
