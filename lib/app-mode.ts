import type { RoleKey } from "@prisma/client";
import type { CurrentUser } from "@/lib/rbac";

export const appMode = process.env.APP_MODE || "approval_lite";

export function isApprovalLiteMode() {
  return appMode === "approval_lite";
}

export const advancedAdminRoles: RoleKey[] = ["SYSTEM_ADMIN"];
export const hiddenAdminAccessRoles: RoleKey[] = ["SYSTEM_ADMIN", "GENERAL_MANAGER", "EXECUTIVE_ASSISTANT"];

export function canSeeAdvancedNavigation(user: CurrentUser | null | undefined) {
  return Boolean(user?.roleKey && advancedAdminRoles.includes(user.roleKey));
}

export function canAccessHiddenAdminArea(user: CurrentUser | null | undefined) {
  return Boolean(user?.roleKey && hiddenAdminAccessRoles.includes(user.roleKey));
}
