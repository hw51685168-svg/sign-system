import { PilotBanner } from "@/components/pilot-banner";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";
import { roleLabels } from "@/lib/labels";
import { allPermissions, canManageSystem } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const permissionLabel: Record<string, string> = {
  "task.view": "查看任務",
  "task.create": "建立任務",
  "task.assign": "指派任務",
  "task.update": "更新任務",
  "task.approve": "確認任務",
  "task.reject": "駁回任務",
  "task.close": "結案任務",
  "task.export": "匯出任務",
  "task.delete": "刪除任務",
  "approval.view": "查看簽呈",
  "approval.create": "新增簽呈",
  "approval.approve": "核准簽呈",
  "approval.reject": "駁回簽呈",
  "approval.return_revision": "退回補件",
  "approval.handwrite_sign": "電子手寫簽名",
  "approval.checkbox_sign": "打勾式簽核",
  "approval.export": "匯出簽呈",
  "issue.view": "查看問題回報",
  "issue.create": "新增問題回報",
  "issue.assign": "指派問題回報",
  "issue.close": "結案問題回報",
  "issue.convert_to_task": "問題轉任務",
  "issue.view_anonymous_identity": "查看敏感身份",
  "notification.view": "查看通知",
  "notification.send": "發送通知",
  "notification.manage": "管理通知",
  "notification.escalate": "通知升級",
  "notification.test_push": "測試推播",
  "finance.view": "查看財務資料",
  "finance.approve": "核准財務資料",
  "finance.export": "匯出財務資料",
  "hr.view": "查看人事資料",
  "hr.manage": "管理人事資料",
  "hr.export": "匯出人事資料",
  "system.manage_users": "管理帳號",
  "system.manage_roles": "管理角色",
  "system.view_audit_logs": "查看 Audit Log（稽核紀錄）",
  "system.manage_settings": "管理系統設定"
};

const scopeLabels: Record<string, string> = {
  GLOBAL: "GLOBAL（全公司）",
  BUSINESS_UNIT: "BUSINESS_UNIT（事業體）",
  DEPARTMENT: "DEPARTMENT（部門）",
  BRANCH: "BRANCH（館別／門市）",
  SELF: "SELF（自己）",
  ASSIGNED: "ASSIGNED（被指派）"
};

function readablePermissions(permissions: string[], prefix: string) {
  const text = permissions.filter((permission) => permission.startsWith(prefix)).map((permission) => permissionLabel[permission] ?? permission);
  return text.length > 0 ? text.join("、") : "無";
}

export default async function RolesPermissionsPage() {
  const user = await requireUser();
  if (!canManageSystem(user) && user.roleKey !== "GENERAL_MANAGER") {
    return <Panel><p className="text-slate-700">你沒有查看 Roles & Permissions（角色與權限）的權限。</p></Panel>;
  }

  const roles = await prisma.role.findMany({ orderBy: { key: "asc" } });

  return (
    <>
      <PilotBanner compact />
      <PageHeader
        title="Roles & Permissions（角色與權限）"
        description="Role（角色）代表職務，Scope（資料範圍）代表能看哪些資料，Permission（操作權限）代表能做哪些動作。"
      />
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-base">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-800">
              <tr>
                <th className="px-3 py-3">角色名稱</th>
                <th className="px-3 py-3">Scope（資料範圍）</th>
                <th className="px-3 py-3">任務</th>
                <th className="px-3 py-3">簽呈</th>
                <th className="px-3 py-3">敏感資料</th>
                <th className="px-3 py-3">系統與通知</th>
                <th className="px-3 py-3">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map((role) => {
                const permissions = role.permissions.length > 0 ? role.permissions : allPermissions.filter((permission) => permission.startsWith("task.") || permission.startsWith("approval."));
                const sensitivePermissions = permissions.filter((permission) => permission.startsWith("finance.") || permission.startsWith("hr.") || permission.includes("anonymous")).map((permission) => permissionLabel[permission] ?? permission);
                const systemPermissions = permissions.filter((permission) => permission.startsWith("system.") || permission.startsWith("notification.")).map((permission) => permissionLabel[permission] ?? permission);
                return (
                  <tr key={role.id} className="align-top hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <p className="font-black text-slate-950">{roleLabels[role.key] ?? role.name}</p>
                      <p className="text-sm text-slate-600">{role.key}</p>
                    </td>
                    <td className="px-3 py-3">{scopeLabels[role.scope]}</td>
                    <td className="px-3 py-3">{readablePermissions(permissions, "task.")}</td>
                    <td className="px-3 py-3">{readablePermissions(permissions, "approval.")}</td>
                    <td className="px-3 py-3">{sensitivePermissions.length > 0 ? sensitivePermissions.join("、") : "無"}</td>
                    <td className="px-3 py-3">{systemPermissions.length > 0 ? systemPermissions.join("、") : "無"}</td>
                    <td className="px-3 py-3"><StatusBadge label={role.isActive ? "啟用" : "停用"} tone={role.isActive ? "green" : "slate"} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
