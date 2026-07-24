import { ApprovalAction, ApprovalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { canWriteApprovalCommunication } from "@/lib/communication-permissions";
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

function resultMessage(action: ApprovalAction, toStatus: ApprovalStatus) {
  if (action === "APPROVE") return toStatus === "APPROVED" ? "已核准簽呈。" : "已核准，簽呈已送往下一關。";
  if (action === "REJECT") return "已駁回簽呈。";
  if (action === "REQUEST_REVISION") return "已退回申請人修改。";
  if (action === "COMMENT") return "留言已送出。";
  if (action === "ADD_APPROVER") return "已新增簽核人。";
  if (action === "TRANSFER") return "已轉派簽核。";
  if (action === "CLOSE") return "已結案。";
  return "操作完成。";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (demoMode) return appRedirect(`/approvals/${id}`);

  const formData = await request.formData();
  const comment = optionalTextValue(formData, "comment");
  const rawAction = textValue(formData, "action") || (comment ? "COMMENT" : "");
  const action = rawAction as ApprovalAction;
  const targetApproverId = optionalTextValue(formData, "targetApproverId");
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
  const userAgent = request.headers.get("user-agent");

  if (!Object.values(ApprovalAction).includes(action)) {
    return actionFailure(request, id, "操作動作不正確，請回到簽呈頁重新按一次按鈕。", 400);
  }

  if (action === "COMMENT" && !comment) {
    return actionFailure(request, id, "留言內容不可空白。", 400);
  }

  const approval = await prisma.approvalRequest.findFirst({
    where: { AND: [{ id: id }, scopedApprovalWhere(user)] },
    include: { steps: { orderBy: { stepOrder: "asc" } }, signatures: true }
  });

  if (!approval) {
    const exists = await prisma.approvalRequest.count({ where: { id: id } });
    return actionFailure(request, id, exists ? "你沒有權限查看或操作這筆簽呈。" : "找不到這筆簽呈。", exists ? 403 : 404);
  }

  if (action === "COMMENT" && !canWriteApprovalCommunication(user, approval)) {
    return actionFailure(request, approval.id, "總經理目前僅保留觀看權限，部門對部門簽呈不開放留言介入。", 403);
  }

  const incompleteStep = approval.steps.find((step) => !step.isCompleted);
  const isCurrentApprover = incompleteStep?.approverId === user.id;

  if (action !== "COMMENT") {
    if (!incompleteStep) {
      return actionFailure(request, approval.id, "這筆簽呈已沒有待處理關卡。", 409);
    }

    if (approval.applicantId === user.id) {
      return actionFailure(request, approval.id, "申請人不能核准、駁回或退回自己的簽呈，請交由指定簽核人處理。", 403);
    }

    if (!isCurrentApprover) {
      return actionFailure(request, approval.id, "你不是目前關卡的簽核人，不能操作這筆簽呈。", 403);
    }

    if (["APPROVED", "REJECTED", "CLOSED", "NEEDS_REVISION"].includes(approval.status)) {
      return actionFailure(request, approval.id, "這筆簽呈已完成，不能重複操作。", 409);
    }
  }

  if ((action === "REJECT" || action === "REQUEST_REVISION") && !comment) {
    return actionFailure(request, approval.id, "駁回或退回修改時，請填寫原因。", 400);
  }

  if ((action === "ADD_APPROVER" || action === "TRANSFER") && !targetApproverId) {
    return actionFailure(request, approval.id, "請選擇要加簽或轉派的人員。", 400);
  }

  if (
    action === "APPROVE" &&
    approval.approvalMode !== "CHECKBOX" &&
    !approval.signatures.some((signature) => signature.signerId === user.id && signature.signaturePurpose === "APPROVER")
  ) {
    return actionFailure(request, approval.id, "此簽呈需要手寫簽名，請先完成簽名再核准。", 400);
  }

  const fromStatus = approval.status;
  let toStatus: ApprovalStatus = approval.status;

  try {
    await prisma.$transaction(async (tx) => {
      if (action === "APPROVE") {
        if (!incompleteStep) throw new ApprovalActionError("這筆簽呈已沒有待處理關卡。", 409);

        const stepUpdate = await tx.approvalStep.updateMany({
          where: { id: incompleteStep.id, isCompleted: false },
          data: { isCompleted: true, completedAt: new Date() }
        });

        if (stepUpdate.count !== 1) {
          throw new ApprovalActionError("簽核狀態已更新，請重新整理後再操作。", 409);
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
          throw new ApprovalActionError("簽呈狀態已更新，請重新整理後再操作。", 409);
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

      const approvalLog = await tx.approvalLog.create({
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
              title: `待簽核：${nextPendingStep.title}`,
              body: "前一關已完成簽核，請進入 JU數位管理查看。",
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
            title: toStatus === "APPROVED" ? "簽呈已核准" : "簽呈已進入下一關",
            body: toStatus === "APPROVED" ? "你的簽呈已完成核准，請進入 JU數位管理查看。" : "你的簽呈已通過目前關卡，將繼續送往下一關。",
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
            title: action === "REJECT" ? "簽呈已駁回" : "簽呈需退回修改",
            body: action === "REJECT" ? "你的簽呈已被駁回，請進入 JU數位管理查看原因。" : "你的簽呈需要補充或修改，請進入 JU數位管理處理。",
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

      if (action === "COMMENT") {
        const recipientIds = Array.from(
          new Set([
            approval.applicantId,
            ...approval.steps.map((step) => step.approverId),
            targetApproverId
          ].filter((id): id is string => Boolean(id) && id !== user.id))
        );

        await Promise.all(
          recipientIds.map((recipientId) =>
            createNotification(
              {
                userId: recipientId,
                title: user.id === approval.applicantId ? "申請人回覆簽呈" : "簽呈有新留言",
                body: `${user.name ?? "相關人員"} 在簽呈中留下回覆，請進入 JU數位管理查看。`,
                type: "APPROVAL_COMMENT",
                priority: "HIGH",
                targetUrl: `/approvals/${approval.id}`,
                sourceType: "approval",
                sourceId: approval.id,
                dedupeKey: `approval:${approval.id}:comment:${approvalLog.id}:${recipientId}`
              },
              tx
            )
          )
        );
      }
    });
  } catch (error) {
    if (error instanceof ApprovalActionError) {
      return actionFailure(request, approval.id, error.message, error.status);
    }
    throw error;
  }

  revalidateApprovalNavigation(approval.id);
  return appRedirect(approvalRedirectPath(approval.id, "actionResult", resultMessage(action, toStatus)));
}
