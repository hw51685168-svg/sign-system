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

const descriptionHeading = "說明事項";
const solutionHeading = "解決 / 執行方式";

export function buildApprovalDescription(description: string, solution: string) {
  return [`${descriptionHeading}\n${description.trim()}`, `${solutionHeading}\n${solution.trim()}`].join("\n\n");
}

export function parseApprovalDescription(value: string | null | undefined) {
  const text = value?.trim() || "";
  const solutionIndex = text.indexOf(solutionHeading);

  if (solutionIndex >= 0) {
    return {
      description: text.slice(0, solutionIndex).replace(descriptionHeading, "").trim(),
      solution: text.slice(solutionIndex + solutionHeading.length).trim()
    };
  }

  return {
    description: text.replace(descriptionHeading, "").trim(),
    solution: ""
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
    if (step?.title.includes("總經理")) return "待總經理簽核";
    if (step?.title.includes("承辦") || step?.title.includes("處理")) return "待承辦部門處理";
    return step?.title ? `${step.title}中` : "待相關部門主管簽核";
  }

  return approvalLiteStatusLabels[approval.status];
}

export function approvalProgressFilter(value?: string) {
  if (value === "reviewing") return { status: { in: ["SUBMITTED", "REVIEWING"] as ApprovalStatus[] } };
  if (value === "approved") return { status: "APPROVED" as ApprovalStatus };
  if (value === "revision") return { status: "NEEDS_REVISION" as ApprovalStatus };
  if (value === "rejected") return { status: "REJECTED" as ApprovalStatus };
  if (value === "returned") return { status: { in: ["NEEDS_REVISION", "REJECTED"] as ApprovalStatus[] } };
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
