import { ErrorReportStatus } from "@prisma/client";
import { appRedirect } from "@/lib/redirect";
import { canAccessErrorCommandCenter } from "@/lib/error-command-center";
import { sanitizeJson } from "@/lib/error-sanitizer";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const allowedStatuses = new Set(Object.values(ErrorReportStatus));

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!canAccessErrorCommandCenter(user)) {
    return new Response("你沒有更新錯誤狀態的權限。", { status: 403 });
  }

  const formData = await request.formData();
  const status = String(formData.get("status") || "TRIAGED") as ErrorReportStatus;
  if (!allowedStatuses.has(status)) return new Response("錯誤狀態不正確。", { status: 400 });
  const isResolved = ["FIXED", "VERIFIED", "CLOSED", "IGNORED"].includes(status);

  await prisma.errorReport.update({
    where: { id: params.id },
    data: {
      status,
      isResolved,
      resolvedAt: isResolved ? new Date() : null,
      resolvedByUserId: isResolved ? user.id : null
    }
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "ERROR_REPORT_STATUS_UPDATE",
      resourceType: "ErrorReport",
      resourceId: params.id,
      metadata: sanitizeJson({ status, isResolved })
    }
  });

  return appRedirect(`/admin/errors/${params.id}`);
}
