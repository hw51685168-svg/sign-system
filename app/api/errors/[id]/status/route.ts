import { ErrorReportStatus } from "@prisma/client";

import { appRedirect } from "@/lib/redirect";
import { canAccessErrorCommandCenter } from "@/lib/error-command-center";
import { sanitizeJson } from "@/lib/error-sanitizer";
import { codexStatusForErrorStatus, isResolvedErrorStatus } from "@/lib/error-status";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const allowedStatuses = new Set(Object.values(ErrorReportStatus));

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canAccessErrorCommandCenter(user)) {
    return new Response("你沒有更新錯誤狀態的權限。", { status: 403 });
  }

  const formData = await request.formData();
  const status = String(formData.get("status") || "TRIAGED") as ErrorReportStatus;
  if (!allowedStatuses.has(status)) return new Response("錯誤狀態不正確。", { status: 400 });

  const isResolved = isResolvedErrorStatus(status);
  const codexStatus = codexStatusForErrorStatus(status);

  await prisma.$transaction(async (tx) => {
    const error = await tx.errorReport.update({
      where: { id: id },
      data: {
        status,
        isResolved,
        resolvedAt: isResolved ? new Date() : null,
        resolvedByUserId: isResolved ? user.id : null
      },
      include: { codexFixRequests: true }
    });

    if (codexStatus) {
      await tx.codexFixRequest.updateMany({
        where: { errorReportId: error.id },
        data: { status: codexStatus }
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "ERROR_REPORT_STATUS_UPDATE",
        resourceType: "ErrorReport",
        resourceId: id,
        metadata: sanitizeJson({
          status,
          isResolved,
          syncedCodexFixRequestStatus: codexStatus,
          codexFixRequestIds: error.codexFixRequests.map((item) => item.id)
        })
      }
    });
  });

  return appRedirect(`/admin/errors/${id}`);
}
