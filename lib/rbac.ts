import type { Prisma, RoleKey } from "@prisma/client";
import type { Session } from "next-auth";

export type CurrentUser = Session["user"];

export const permissionGroups = {
  task: ["task.view", "task.create", "task.assign", "task.update", "task.approve", "task.reject", "task.close", "task.export", "task.delete"],
  approval: [
    "approval.view",
    "approval.create",
    "approval.approve",
    "approval.reject",
    "approval.return_revision",
    "approval.handwrite_sign",
    "approval.checkbox_sign",
    "approval.export"
  ],
  issue: ["issue.view", "issue.create", "issue.assign", "issue.close", "issue.convert_to_task", "issue.convert_to_monster", "issue.view_anonymous_identity"],
  notification: ["notification.view", "notification.send", "notification.manage", "notification.escalate", "notification.test_push"],
  document: ["document.view", "document.create", "document.update", "document.approve", "document.export"],
  inventory: ["inventory.view", "inventory.create", "inventory.update", "inventory.approve", "inventory.export"],
  course: ["course.view", "course.create", "course.assign", "course.complete", "course.report"],
  finance: ["finance.view", "finance.approve", "finance.export"],
  hr: ["hr.view", "hr.manage", "hr.export"],
  system: ["system.manage_users", "system.manage_roles", "system.view_audit_logs", "system.manage_settings"]
} as const;

export const allPermissions = Object.values(permissionGroups).flat();

export const headOfficeRoleKeys: RoleKey[] = [
  "EXECUTIVE_ASSISTANT",
  "ADMIN_MANAGER",
  "ACCOUNTING_MANAGER",
  "DESIGN_MANAGER",
  "SOCIAL_MEDIA_MANAGER",
  "HR_MANAGER",
  "CONSTRUCTION_MANAGER",
  "MANAGER"
];

export const storeScopedRoleKeys: RoleKey[] = ["BRANCH_MANAGER", "STORE_STAFF", "STORE_REQUESTER"];

const legacyPermissions: Record<RoleKey, string[]> = {
  GENERAL_MANAGER: allPermissions,
  EXECUTIVE_ASSISTANT: [
    "task.view", "task.create", "task.assign", "task.update", "task.close", "approval.view", "approval.create", "approval.approve", "approval.reject", "approval.return_revision", "issue.view", "issue.assign", "notification.view",
    "notification.send", "notification.escalate", "document.view", "inventory.view", "course.view"
  ],
  ADMIN_MANAGER: ["task.view", "task.create", "task.assign", "task.update", "task.approve", "approval.view", "approval.create", "approval.approve", "issue.view", "issue.assign", "notification.view", "notification.send", "document.view", "document.create", "inventory.view"],
  ACCOUNTING_MANAGER: ["task.view", "task.create", "task.assign", "task.update", "approval.view", "approval.create", "approval.approve", "approval.reject", "approval.return_revision", "finance.view", "finance.approve", "finance.export", "notification.view"],
  DESIGN_MANAGER: ["task.view", "task.create", "task.assign", "task.update", "task.approve", "approval.view", "approval.create", "approval.approve", "approval.reject", "approval.return_revision", "notification.view", "document.view"],
  SOCIAL_MEDIA_MANAGER: ["task.view", "task.create", "task.assign", "task.update", "task.approve", "approval.view", "approval.create", "notification.view", "course.view"],
  HR_MANAGER: ["task.view", "task.create", "task.assign", "task.update", "task.approve", "approval.view", "approval.create", "hr.view", "hr.manage", "hr.export", "notification.view", "course.view", "course.assign"],
  CONSTRUCTION_MANAGER: ["task.view", "task.create", "task.assign", "task.update", "task.approve", "approval.view", "approval.create", "approval.approve", "inventory.view", "notification.view"],
  BRANCH_MANAGER: ["task.view", "task.create", "task.assign", "task.update", "task.approve", "approval.view", "approval.create", "issue.view", "issue.create", "issue.assign", "inventory.view", "inventory.create", "notification.view"],
  MANAGER: ["task.view", "task.create", "task.assign", "task.update", "task.approve", "approval.view", "approval.create", "approval.approve", "approval.reject", "approval.return_revision", "issue.view", "issue.create", "issue.assign", "notification.view"],
  STAFF: ["task.view", "task.update", "approval.view", "approval.create", "issue.create", "notification.view", "inventory.create"],
  STORE_STAFF: ["task.view", "task.update", "approval.view", "approval.create", "issue.create", "notification.view", "inventory.create"],
  STORE_REQUESTER: ["task.view", "approval.view", "approval.create", "notification.view"],
  SYSTEM_ADMIN: allPermissions,
  TESTER: ["task.view", "approval.view", "issue.view", "notification.view"]
};

export function isExecutive(roleKey: RoleKey) {
  return roleKey === "GENERAL_MANAGER";
}

export function isExecutiveAssistant(roleKey: RoleKey) {
  return roleKey === "EXECUTIVE_ASSISTANT";
}

export function isDepartmentManager(roleKey: RoleKey) {
  return headOfficeRoleKeys.includes(roleKey);
}

export function isBranchManager(roleKey: RoleKey) {
  return roleKey === "BRANCH_MANAGER";
}

export function isHeadOfficeRole(roleKey: RoleKey) {
  return roleKey === "GENERAL_MANAGER" || roleKey === "SYSTEM_ADMIN" || headOfficeRoleKeys.includes(roleKey);
}

export function isStoreScopedRole(roleKey: RoleKey) {
  return storeScopedRoleKeys.includes(roleKey);
}

export function dataScope(user: CurrentUser): "GLOBAL" | "COMPANY" | "STORE" | "SELF" {
  if (user.roleKey === "GENERAL_MANAGER" || user.roleKey === "SYSTEM_ADMIN") return "GLOBAL";
  if (headOfficeRoleKeys.includes(user.roleKey)) return "COMPANY";
  if (isStoreScopedRole(user.roleKey) || user.storeId) return "STORE";
  if (user.roleKey === "STAFF" && !user.storeId) return "COMPANY";
  return "SELF";
}

export function hasPermission(user: CurrentUser, permission: string) {
  return user.permissions?.includes(permission) || legacyPermissions[user.roleKey]?.includes(permission) || false;
}

export function hasAnyPermission(user: CurrentUser, permissions: string[]) {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function canViewAllBusinessData(user: CurrentUser) {
  const scope = dataScope(user);
  return scope === "GLOBAL" || scope === "COMPANY";
}

export function canManageSystem(user: CurrentUser) {
  return hasPermission(user, "system.manage_users") || user.roleKey === "SYSTEM_ADMIN";
}

export function canApprove(user: CurrentUser) {
  return hasAnyPermission(user, ["approval.approve", "task.approve"]);
}

export function canFinalApproveApproval(user: CurrentUser) {
  return user.roleKey === "GENERAL_MANAGER";
}

export function canCreateApprovals(user: CurrentUser) {
  if (user.roleKey === "GENERAL_MANAGER") return false;
  return hasPermission(user, "approval.create");
}

export function canAssignTasks(user: CurrentUser) {
  return hasPermission(user, "task.assign") || canViewAllBusinessData(user);
}

export function canCreateOperationalReports(user: CurrentUser) {
  return hasAnyPermission(user, ["approval.create", "issue.create", "inventory.create"]);
}

function scopeOrSelf(user: CurrentUser): Prisma.TaskWhereInput[] {
  if (canViewAllBusinessData(user)) return [{}];
  if (dataScope(user) === "STORE") {
    return [
      user.storeId ? { storeId: user.storeId } : { id: "__NO_STORE_SCOPE__" },
      { ownerId: user.id },
      { creatorId: user.id },
      { assistants: { some: { userId: user.id } } }
    ];
  }
  return [{ ownerId: user.id }, { creatorId: user.id }, { assistants: { some: { userId: user.id } } }];
}

export function scopedTaskWhere(user: CurrentUser): Prisma.TaskWhereInput {
  if (!hasPermission(user, "task.view")) return { id: "__NO_ACCESS__" };
  const ors = scopeOrSelf(user);
  return ors.length === 1 && Object.keys(ors[0]).length === 0 ? {} : { OR: ors };
}

export function scopedApprovalWhere(user: CurrentUser): Prisma.ApprovalRequestWhereInput {
  if (!hasPermission(user, "approval.view")) return { id: "__NO_ACCESS__" };
  if (canViewAllBusinessData(user)) return {};
  if (dataScope(user) === "STORE") {
    return {
      OR: [
        { applicantId: user.id },
        user.storeId ? { storeId: user.storeId } : { id: "__NO_STORE_SCOPE__" },
        { steps: { some: { approverId: user.id } } }
      ]
    };
  }
  return {
    OR: [
      { applicantId: user.id },
      { steps: { some: { approverId: user.id } } }
    ]
  };
}

export function scopedIssueWhere(user: CurrentUser): Prisma.IssueReportWhereInput {
  if (!hasPermission(user, "issue.view") && !hasPermission(user, "issue.create")) return { id: "__NO_ACCESS__" };
  if (canViewAllBusinessData(user)) return {};
  if (dataScope(user) === "STORE") {
    return {
      OR: [
        { reporterId: user.id },
        user.storeId ? { storeId: user.storeId } : { id: "__NO_STORE_SCOPE__" }
      ]
    };
  }
  return {
    OR: [
      { reporterId: user.id },
      { storeId: user.storeId ?? undefined },
      { assignedDepartmentId: user.departmentId ?? undefined }
    ]
  };
}

export function scopedServiceRequestWhere(user: CurrentUser): Prisma.ServiceRequestWhereInput {
  if (canViewAllBusinessData(user)) return {};
  if (dataScope(user) === "STORE") {
    return {
      OR: [
        { requesterId: user.id },
        { ownerId: user.id },
        user.storeId ? { storeId: user.storeId } : { id: "__NO_STORE_SCOPE__" },
        { assistants: { some: { userId: user.id } } }
      ]
    };
  }
  return {
    OR: [
      { requesterId: user.id },
      { ownerId: user.id },
      { assistants: { some: { userId: user.id } } }
    ]
  };
}

export function announcementVisibleWhere(user: CurrentUser): Prisma.AnnouncementWhereInput {
  if (canViewAllBusinessData(user)) return {};
  return {
    targets: {
      some: {
        OR: [
          { type: "ALL" },
          { type: "DEPARTMENT", departmentId: user.departmentId ?? undefined },
          { type: "STORE", storeId: user.storeId ?? undefined }
        ]
      }
    }
  };
}
