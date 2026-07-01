import type { CodexFixRequestStatus, ErrorReportStatus, ErrorSeverity } from "@prisma/client";

export const errorSeverityLabels: Record<ErrorSeverity, string> = {
  P0: "P0 阻擋測試",
  P1: "P1 嚴重",
  P2: "P2 一般",
  P3: "P3 建議"
};

export const errorStatusLabels: Record<ErrorReportStatus, string> = {
  OPEN: "未處理",
  TRIAGED: "已分流",
  CODEX_REQUESTED: "已建立 Codex 修復單",
  IN_PROGRESS: "修復中",
  FIXED: "已修復",
  VERIFIED: "已驗證",
  CLOSED: "已關閉",
  IGNORED: "忽略"
};

export const codexFixStatusLabels: Record<CodexFixRequestStatus, string> = {
  DRAFT: "草稿",
  READY: "待送 Codex",
  SENT_TO_CODEX: "已寫入 CODEX_INBOX",
  GITHUB_ISSUE_CREATED: "已建立 GitHub Issue",
  IN_PROGRESS: "修復中",
  FIX_PROPOSED: "已有修復方案",
  FIXED: "已修復",
  VERIFIED: "已驗證",
  CLOSED: "已關閉",
  REJECTED: "不處理"
};

export function errorSeverityTone(severity: ErrorSeverity) {
  if (severity === "P0") return "red" as const;
  if (severity === "P1") return "amber" as const;
  if (severity === "P2") return "blue" as const;
  return "slate" as const;
}

export function errorStatusTone(status: ErrorReportStatus | CodexFixRequestStatus) {
  if (["FIXED", "VERIFIED", "CLOSED"].includes(status)) return "green" as const;
  if (["OPEN", "DRAFT", "READY"].includes(status)) return "amber" as const;
  if (["IGNORED", "REJECTED"].includes(status)) return "slate" as const;
  return "blue" as const;
}
