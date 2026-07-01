import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateApprovalNavigation } from "@/lib/navigation-revalidate";
import { hasPermission, scopedApprovalWhere } from "@/lib/rbac";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();

  const { signatureDataUrl } = (await request.json()) as { signatureDataUrl?: string };
  if (!signatureDataUrl?.startsWith("data:image/png;base64,")) {
    return NextResponse.json({ error: "簽名資料格式不正確。" }, { status: 400 });
  }

  const approval = await prisma.approvalRequest.findFirst({
    where: { AND: [{ id: params.id }, scopedApprovalWhere(user)] },
    include: { applicant: true, steps: { orderBy: { stepOrder: "asc" } }, signatures: true }
  });
  if (!approval) {
    const exists = await prisma.approvalRequest.count({ where: { id: params.id } });
    return NextResponse.json({ error: exists ? "權限不足，無法簽署這張簽呈。" : "找不到簽呈。" }, { status: exists ? 403 : 404 });
  }
  const currentStep = approval.steps.find((step) => !step.isCompleted);
  const isCurrentApprover = currentStep?.approverId === user.id;
  if (!isCurrentApprover) {
    return NextResponse.json({ error: "只有目前簽核人可以簽名。" }, { status: 403 });
  }
  if (!hasPermission(user, "approval.handwrite_sign")) {
    return NextResponse.json({ error: "權限不足，無法使用電子手寫簽名。" }, { status: 403 });
  }
  if (approval.approvalMode === "CHECKBOX") {
    return NextResponse.json({ error: "此簽呈為打勾式簽核，不需要手寫簽名。" }, { status: 400 });
  }

  if (approval.signatures.some((signature) => signature.signerId === user.id)) {
    return NextResponse.json({ error: "你已經完成簽名，簽名儲存後不可任意修改。" }, { status: 409 });
  }

  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
  const userAgent = request.headers.get("user-agent");
  const contentSnapshot = JSON.stringify({
    requestNo: approval.requestNo,
    subject: approval.subject,
    description: approval.description,
    amount: approval.amount?.toString() ?? null,
    contentVersion: approval.contentVersion,
    signedAt: new Date().toISOString()
  });

  await prisma.$transaction(async (tx) => {
    await tx.approvalSignature.create({
      data: {
        approvalRequestId: approval.id,
        signerId: user.id,
        signatureDataUrl,
        contentSnapshot,
        ipAddress,
        userAgent
      }
    });
    await tx.approvalLog.create({
      data: {
        approvalRequestId: approval.id,
        actorId: user.id,
        action: "COMMENT",
        comment: "完成電子手寫簽名",
        fromStatus: approval.status,
        toStatus: approval.status,
        ipAddress,
        userAgent
      }
    });
  });

  revalidateApprovalNavigation(approval.id);
  return appRedirect(`/approvals/${approval.id}?signature=1`);
}
