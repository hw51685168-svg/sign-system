import type { CodexFixRequestStatus, ErrorReportStatus } from "@prisma/client";

export const resolvedErrorStatuses: ErrorReportStatus[] = ["FIXED", "VERIFIED", "CLOSED", "IGNORED"];
export const unresolvedErrorStatuses: ErrorReportStatus[] = ["OPEN", "TRIAGED", "CODEX_REQUESTED", "IN_PROGRESS"];
export const pendingCodexFixStatuses: CodexFixRequestStatus[] = ["DRAFT", "READY", "SENT_TO_CODEX", "GITHUB_ISSUE_CREATED", "IN_PROGRESS", "FIX_PROPOSED"];

export function isResolvedErrorStatus(status: ErrorReportStatus) {
  return resolvedErrorStatuses.includes(status);
}

export function codexStatusForErrorStatus(status: ErrorReportStatus): CodexFixRequestStatus | null {
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "FIXED") return "FIXED";
  if (status === "VERIFIED") return "VERIFIED";
  if (status === "CLOSED" || status === "IGNORED") return "CLOSED";
  return null;
}
