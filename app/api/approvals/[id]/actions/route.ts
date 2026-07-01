import { ApprovalAction, ApprovalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { revalidateApprovalNavigation } from "@/lib/navigation-revalidate";
import { scopedApprovalWhere } from "@/lib/rbac";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { demoMode } from "@/lib/demo";

class ApprovalActionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function wantsJson(request: Request) {
  const accept = request.headers.get("accept") || "";
  return accept.includes("application/json") && !accept.includes("text/html");
}

function approvalRedirectPath(id: string, key: "actionResult" | "actionError", value: string) {
  const searchParams = new URLSearchParams({ [key]: value });
  return `/approvals/${id}?${searchParams.toString()}`;
}

function actionFailure(request: Request, approvalId: string, message: string, status = 400) {
  if (wantsJson(request)) return NextResponse.json({ error: message }, { status });
  return appRedirect(approvalRedirectPath(approvalId, "actionError", message));
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (demoMode) return appRedirect(`/approvals/${params.id}`);

  const formData = await request.formData();
  const comment = optionalTextValue(formData, "comment");
  const rawAction = textValue(formData, "action") || (comment ? "COMMENT" : "");
  const action = rawAction as ApprovalAction;
  const targetApproverId = optionalTextValue(formData, "targetApproverId");
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
  const userAgent = request.headers.get("user-agent");

  if (!Object.values(ApprovalAction).includes(action)) {
    return actionFailure(request, params.id, "操作動作不正確，請回到簽呈頁重新按一次按鈕。", 400);
  }

  if (action === "COMMENT" && !comment) {
    return actionFailure(request, params.id, "留言內容不可空白。", 400);
  }

  const approval = await prisma.approvalRequest.findFirst({
    where: { AND: [{ id: params.id }, scopedApprovalWhere(user)] },
    include: { steps: { orderBy: { stepOrder: "asc" } }, signatures: true }
  });

  if (!approval) {
    const exists = await prisma.approvalRequest.count({ where: { id: params.id } });
    return actionFailure(request, params.id, exists ? "權限不足，無法查看或操作這張簽呈。" : "找不到簽呈。", exists ? 403 : 404);
  }

  const incompleteStep = approval.steps.find((step) => !step.isCompleted);
  const isCurrentApprover = incompleteStep?.approverId === user.id;

  if (action !== "COMMENT") {
    if (!incompleteStep) {
      return actionFailure(request, approval.id, "此簽呈目前沒有待簽核關卡。", 409);
    }

    if (!isCurrentApprover) {
      return actionFailure(request, approval.id, "你不是目前關卡的簽核人，無法操作這張簽呈。", 403);
    }

    if (["APPROVED", "REJECTED", "CLOSED", "NEEDS_REVISION"].includes(approval.status)) {
      return actionFailure(request, approval.id, "此簽呈目前不可簽核，請重新整理查看最新狀態。", 409);
    }
  }

  if ((action === "REJECT" || action === "REQUEST_REVISION") && !comment) {
    return actionFailure(request, approval.id, "駁回或退回修改時，請填寫原因。", 400);
  }

  if ((action === "ADD_APPROVER" || action === "TRANSFER") && !targetApproverId) {
    return actionFailure(request, approval.id, "請先指定加簽或轉派的人員。", 400);
  }

  if (
    action === "APPROVE" &&
    user.roleKey === "GENERAL_MANAGER" &&
    approval.approvalMode !== "CHECKBOX" &&
    !approval.signatures.some((signature) => signature.signerId === user.id)
  ) {
    return actionFailure(request, approval.id, "請先完成電子手寫簽名，再按核准。", 400);
  }

  const fromStatus = approval.status;
  let toStatus: ApprovalStatus = approval.status;

  try {
    await prisma.$transaction(async (tx) => {
      if (action === "APPROVE") {
        if (!incompleteStep) throw new ApprovalActionError("此簽呈目前沒有待簽核關卡。", 409);

        const stepUpdate = await tx.approvalStep.updateMany({
          where: { id: incompleteStep.id, isCompleted: false },
          data: { isCompleted: true, completedAt: new Date() }
        });

        if (stepUpdate.count !== 1) {
          throw new ApprovalActionError("此關卡已被處理，請重新整理查看最新狀態。", 409);
        }

        const remaining = approval.steps.filter((step) => !step.isCompleted && step.id !== incompleteStep.id);
        const nextStep = remaining.sort((a, b) => a.stepOrder - b.stepOrder)[0];
        toStatus = remaining.length === 0 ? "APPROVED" : "REVIEWING";

        await tx.approvalRequest.update({
          where: { id: approval.id },
          data: {
            status: toStatus,
            currentStep: nextStep?.stepOrder ?? incompleteStep.stepOrder
          }
        });
      }

      if (action === "REJECT" || action === "REQUEST_REVISION" || action === "CLOSE") {
        toStatus = action === "REJECT" ? "REJECTED" : action === "REQUEST_REVISION" ? "NEEDS_REVISION" : "CLOSED";
        const requestUpdate = await tx.approvalRequest.updateMany({
          where: {
            id: approval.id,
            status: { notIn: ["APPROVED", "REJECTED", "CLOSED", "NEEDS_REVISION"] }
          },
          data: { status: toStatus }
        });

        if (requestUpdate.count !== 1) {
          throw new ApprovalActionError("此簽呈已被處理，請重新整理查看最新狀態。", 409);
        }
      }

      if (action === "ADD_APPROVER" && targetApproverId) {
        const maxOrder = Math.max(0, ...approval.steps.map((step) => step.stepOrder));
        await tx.approvalStep.create({
          data: {
            approvalRequestId: approval.id,
            stepOrder: maxOrder + 1,
            title: "加簽",
            approverId: targetApproverId,
            createdById: user.id
          }
        });
        toStatus = "REVIEWING";
        await tx.approvalRequest.update({ where: { id: approval.id }, data: { status: toStatus } });
      }

      if (action === "TRANSFER" && targetApproverId && incompleteStep) {
        await tx.approvalStep.update({
          where: { id: incompleteStep.id },
          data: { approverId: targetApproverId, title: "轉派簽核" }
        });
        toStatus = "REVIEWING";
        await tx.approvalRequest.update({ where: { id: approval.id }, data: { status: toStatus } });
      }

      await tx.approvalLog.create({
        data: {
          approvalRequestId: approval.id,
          actorId: user.id,
          action,
          comment,
          fromStatus,
          toStatus: action === "COMMENT" ? fromStatus : toStatus,
          ipAddress,
          userAgent
        }
      });

      if (action === "APPROVE") {
        const nextPendingStep = approval.steps
          .filter((step) => !step.isCompleted && step.id !== incompleteStep?.id)
          .sort((a, b) => a.stepOrder - b.stepOrder)[0];

        if (nextPendingStep?.approverId) {
          await createNotification(
            {
              userId: nextPendingStep.approverId,
              title: nextPendingStep.title.includes("總經理") ? "有簽呈待總經理簽核" : "有簽呈待主管審核",
              body: `${approval.subject} 已進入你的簽核關卡。`,
              type: "APPROVAL_PENDING",
              priority: "HIGH",
              targetUrl: `/approvals/${approval.id}`,
              sourceType: "approval",
              sourceId: approval.id,
              dedupeKey: `approval:${approval.id}:pending:${nextPendingStep.approverId}:${nextPendingStep.id}`
            },
            tx
          );
        }

        await createNotification(
          {
            userId: approval.applicantId,
            title: toStatus === "APPROVED" ? "簽呈已核准" : "簽呈已完成一關簽核",
            body: toStatus === "APPROVED" ? `${approval.subject} 已完成核准。` : `${approval.subject} 已進入下一關。`,
            type: toStatus === "APPROVED" ? "APPROVAL_APPROVED" : "APPROVAL_PENDING",
            priority: toStatus === "APPROVED" ? "MEDIUM" : "LOW",
            targetUrl: `/approvals/${approval.id}`,
            sourceType: "approval",
            sourceId: approval.id,
            dedupeKey: `approval:${approval.id}:approve:${user.id}:${incompleteStep?.id ?? "final"}`
          },
          tx
        );
      }

      if (action === "REJECT" || action === "REQUEST_REVISION") {
        await createNotification(
          {
            userId: approval.applicantId,
            title: action === "REJECT" ? "簽呈已駁回" : "簽呈退回修改",
            body: comment ?? "請查看簽呈詳情。",
            type: action === "REJECT" ? "APPROVAL_REJECTED" : "APPROVAL_REVISION_REQUIRED",
            priority: "HIGH",
            targetUrl: `/approvals/${approval.id}`,
            sourceType: "approval",
            sourceId: approval.id,
            dedupeKey: `approval:${approval.id}:${action}:${approval.applicantId}`
          },
          tx
        );
      }

      if (action === "COMMENT" && user.id !== approval.applicantId) {
        await createNotification(
          {
            userId: approval.applicantId,
            title: "簽呈有新留言",
            body: comment ?? "請查看簽呈詳情。",
            type: "APPROVAL_COMMENT",
            priority: "MEDIUM",
            targetUrl: `/approvals/${approval.id}`,
            sourceType: "approval",
            sourceId: approval.id,
            dedupeKey: `approval:${approval.id}:comment:${user.id}:${(comment ?? "").slice(0, 80)}`
          },
          tx
        );
      }
    });
  } catch (error) {
    if (error instanceof ApprovalActionError) {
      return actionFailure(request, approval.id, error.message, error.status);
    }
    throw error;
  }

  const result =
    action === "APPROVE"
      ? toStatus === "APPROVED"
        ? "approved-final"
        : "approved"
      : action === "REJECT"
        ? "rejected"
        : action === "REQUEST_REVISION"
          ? "revision"
          : action === "COMMENT"
            ? "comment"
            : "updated";

  revalidateApprovalNavigation(approval.id);
  return appRedirect(approvalRedirectPath(approval.id, "actionResult", result));
}
