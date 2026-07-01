import { revalidatePath } from "next/cache";

function unique(paths: Array<string | null | undefined>) {
  return Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
}

export function revalidateNavigationPaths(paths: Array<string | null | undefined>) {
  for (const path of unique(["/", ...paths])) {
    revalidatePath(path);
  }
}

export function revalidateApprovalNavigation(approvalId?: string | null) {
  revalidateNavigationPaths([
    "/approvals",
    "/approvals/progress",
    approvalId ? `/approvals/${approvalId}` : null,
    "/notifications"
  ]);
}

export function revalidateGmTaskNavigation(taskId?: string | null) {
  revalidateNavigationPaths([
    "/gm/tasks",
    "/tasks",
    taskId ? `/tasks/${taskId}` : null,
    "/notifications"
  ]);
}

export function revalidateNotificationNavigation() {
  revalidateNavigationPaths([
    "/notifications",
    "/settings/notifications"
  ]);
}
