import type { ApprovalRequest, ApprovalStatus, ApprovalStep, User } from "@prisma/client";
import type { CurrentUser } from "@/lib/rbac";

export const approvalLiteStatusLabels: Record<ApprovalStatus, string> = {
  DRAFT: "草稿",
  SUBMITTED: "已送出",
  REVIEWING: "審核中",
  NEEDS_REVISION: "退回修改",
  APPROVED: "已核准",
  REJECTED: "已駁回",
  IN_PROGRESS: "執行中",
  CLOSED: "已結案"
};

export function buildApprovalDescription(description: string, solution: string) {
  return [`【說明事項】\n${description.trim()}`, `【解決 / 執行方式】\n${solution.trim()}`].join("\n\n");
}

export function parseApprovalDescription(value: string | null | undefined) {
  const text = value?.trim() || "";
  const descriptionMatch = text.match(/【說明事項】\s*([\s\S]*?)(?=\n\s*【解決 \/ 執行方式】|$)/);
  const solutionMatch = text.match(/【解決 \/ 執行方式】\s*([\s\S]*)$/);
  return {
    description: (descriptionMatch?.[1] || text).trim(),
    solution: (solutionMatch?.[1] || "").trim()
  };
}

export function currentApprovalStep(
  approval: Pick<ApprovalRequest, "status"> & {
    steps: Array<Pick<ApprovalStep, "isCompleted" | "stepOrder" | "title" | "approverId"> & { approver?: Pick<User, "name"> | null }>;
  }
) {
  return approval.steps.find((step) => !step.isCompleted) ?? approval.steps[approval.steps.length - 1] ?? null;
}

export function approvalStageLabel(
  approval: Pick<ApprovalRequest, "status"> & {
    steps: Array<Pick<ApprovalStep, "isCompleted" | "stepOrder" | "title" | "approverId"> & { approver?: Pick<User, "name"> | null }>;
  }
) {
  if (approval.status === "REVIEWING") {
    const step = currentApprovalStep(approval);
    if (step?.title.includes("總經理") || step?.stepOrder === 2) return "總經理審核中";
    return "部門主管審核中";
  }
  return approvalLiteStatusLabels[approval.status];
}

export function approvalProgressFilter(value?: string) {
  if (value === "reviewing") return { status: { in: ["SUBMITTED", "REVIEWING"] as ApprovalStatus[] } };
  if (value === "approved") return { status: "APPROVED" as ApprovalStatus };
  if (value === "revision") return { status: "NEEDS_REVISION" as ApprovalStatus };
  if (value === "rejected") return { status: "REJECTED" as ApprovalStatus };
  return {};
}

export function isApprovalReviewer(user: CurrentUser, approval: { steps: Array<Pick<ApprovalStep, "approverId" | "isCompleted">> }) {
  const step = approval.steps.find((item) => !item.isCompleted);
  return step?.approverId === user.id;
}

export function canUseApprovalAction(user: CurrentUser, approval: { status: ApprovalStatus; steps: Array<Pick<ApprovalStep, "approverId" | "isCompleted">> }) {
  if (["APPROVED", "REJECTED", "CLOSED", "NEEDS_REVISION"].includes(approval.status)) return false;
  return isApprovalReviewer(user, approval);
}
