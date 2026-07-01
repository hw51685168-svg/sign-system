import { RoleKey } from "@prisma/client";
import { Building2, KeyRound, Power, RotateCcw, ShieldCheck, Store, UserCog, UserPlus, Users } from "lucide-react";
import { Button, Field, LinkButton, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { canManageSystem } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { demoDepartments, demoMode, demoRoles, demoStores, demoUsers } from "@/lib/demo";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: { id: string; key: RoleKey; name: string };
  department: { id?: string; name: string } | null;
  store: { id?: string; name: string } | null;
  isActive: boolean;
  lastLoginAt?: Date | string | null;
};

type RoleRow = { id: string; key: RoleKey; name: string };
type DepartmentRow = { id: string; name: string };
type StoreRow = { id: string; name: string; brand?: string | null; isActive?: boolean };

const roleOrder: RoleKey[] = [
  "SYSTEM_ADMIN",
  "GENERAL_MANAGER",
  "EXECUTIVE_ASSISTANT",
  "ADMIN_MANAGER",
  "HR_MANAGER",
  "SOCIAL_MEDIA_MANAGER",
  "DESIGN_MANAGER",
  "ACCOUNTING_MANAGER",
  "CONSTRUCTION_MANAGER",
  "BRANCH_MANAGER",
  "MANAGER",
  "STAFF",
  "STORE_STAFF",
  "TESTER"
];

const structureGroups = [
  { title: "經營管理", names: ["總經理室", "總公司"] },
  { title: "總公司部門", names: ["行政部門", "人事部門", "自媒體部門", "美工部門", "會計部門", "建設部門", "倉管或採購單位", "行政部", "人事部", "自媒體部", "美工部", "會計部", "倉管部"] },
  { title: "品牌與館別", names: ["好腳舍足體養身會館", "屏東瑞光館", "高雄仁武館", "好腳舍瑞光館", "好腳舍仁武館", "好腳舍高雄館", "EFS服飾店", "EFS 服飾門市"] }
];

const statusMessage: Record<string, string> = {
  created: "已建立並啟用帳號。",
  updated: "已更新人員權限與歸屬。",
  deactivated: "已停用帳號，離職人員將無法登入。",
  reactivated: "已重新啟用帳號。",
  "password-reset": "已重設密碼。",
  "cannot-deactivate-self": "不能停用目前登入中的自己，避免系統無人可管理。"
};

function roleSort(a: RoleRow, b: RoleRow) {
  return roleOrder.indexOf(a.key) - roleOrder.indexOf(b.key);
}

function roleLabel(role: { key: RoleKey; name: string }) {
  return role.name || role.key;
}

function formatDate(value?: Date | string | null) {
  if (!value) return "尚未登入";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function classifyUser(user: UserRow) {
  if (user.role.key === "GENERAL_MANAGER" || user.role.key === "EXECUTIVE_ASSISTANT" || user.role.key === "SYSTEM_ADMIN") return "經營管理";
  const departmentName = user.department?.name ?? "";
  const storeName = user.store?.name ?? "";
  const matched = structureGroups.find((group) => group.names.some((name) => departmentName.includes(name) || storeName.includes(name)));
  return matched?.title ?? "其他";
}

function UserCard({
  item,
  roles,
  departments,
  stores,
  currentUserId
}: {
  item: UserRow;
  roles: RoleRow[];
  departments: DepartmentRow[];
  stores: StoreRow[];
  currentUserId: string;
}) {
  const isSelf = item.id === currentUserId;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-black text-slate-950">{item.name}</h3>
            <StatusBadge label={item.isActive ? "在職 / 可登入" : "離職 / 已停用"} tone={item.isActive ? "green" : "slate"} />
            {isSelf ? <StatusBadge label="目前登入" tone="blue" /> : null}
          </div>
          <p className="mt-1 break-all text-base font-semibold text-slate-600">{item.email}</p>
          <p className="mt-2 text-lg font-black text-slate-800">{roleLabel(item.role)}</p>
          <p className="mt-1 text-base font-semibold text-slate-600">
            {item.department?.name ?? "未指定部門"} {item.store?.name ? ` / ${item.store.name}` : ""}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500">最後登入：{formatDate(item.lastLoginAt)}</p>
        </div>
        <details className="w-full rounded-lg border border-brand-200 bg-brand-50 xl:max-w-xl">
          <summary className="cursor-pointer list-none px-4 py-3 text-lg font-black text-brand-900">
            調整權限 / 人員狀態
          </summary>
          <div className="grid gap-4 border-t border-brand-100 bg-white p-4">
            <form action="/api/admin/users" method="post" className="grid gap-3">
              <input type="hidden" name="action" value="UPDATE" />
              <input type="hidden" name="userId" value={item.id} />
              <Field label="姓名">
                <input name="name" defaultValue={item.name} required />
              </Field>
              <Field label="角色 / 權限等級">
                <select name="roleId" defaultValue={item.role.id} required>
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="部門">
                  <select name="departmentId" defaultValue={item.department?.id ?? ""}>
                    <option value="">未指定</option>
                    {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                </Field>
                <Field label="門市 / 館別">
                  <select name="storeId" defaultValue={item.store?.id ?? ""}>
                    <option value="">未指定</option>
                    {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
                  </select>
                </Field>
              </div>
              <Button type="submit"><ShieldCheck className="h-4 w-4" />儲存權限與歸屬</Button>
            </form>

            <form action="/api/admin/users" method="post" className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <input type="hidden" name="action" value="RESET_PASSWORD" />
              <input type="hidden" name="userId" value={item.id} />
              <Field label="重設密碼">
                <input name="password" type="password" defaultValue="aaaa8888" required />
              </Field>
              <Button type="submit" variant="secondary"><KeyRound className="h-4 w-4" />重設密碼</Button>
            </form>

            {item.isActive ? (
              <form action="/api/admin/users" method="post">
                <input type="hidden" name="action" value="DEACTIVATE" />
                <input type="hidden" name="userId" value={item.id} />
                <Button type="submit" variant="danger" disabled={isSelf}><Power className="h-4 w-4" />離職停用帳號</Button>
              </form>
            ) : (
              <form action="/api/admin/users" method="post">
                <input type="hidden" name="action" value="REACTIVATE" />
                <input type="hidden" name="userId" value={item.id} />
                <Button type="submit" variant="secondary"><RotateCcw className="h-4 w-4" />重新啟用帳號</Button>
              </form>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}

export default async function UsersAdminPage({ searchParams }: { searchParams?: { status?: string } }) {
  const currentUser = await requireUser();
  if (!canManageSystem(currentUser)) {
    return <Panel><p className="text-lg font-semibold text-slate-700">您沒有權限進入使用者與權限管理。</p></Panel>;
  }

  const [users, roles, departments, stores] = demoMode
    ? [
        demoUsers.map((item) => ({
          ...item,
          role: { ...item.role, id: item.role.id, name: item.role.name },
          department: item.departmentName ? { id: item.departmentId ?? undefined, name: item.departmentName } : null,
          store: item.storeName ? { id: item.storeId ?? undefined, name: item.storeName } : null
        })) as UserRow[],
        demoRoles.map((role) => ({ ...role, id: role.id, name: role.name })) as RoleRow[],
        demoDepartments as DepartmentRow[],
        demoStores as StoreRow[]
      ]
    : await Promise.all([
        prisma.user.findMany({ include: { role: true, department: true, store: true }, orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] }) as Promise<UserRow[]>,
        prisma.role.findMany({ where: { isActive: true }, orderBy: { key: "asc" } }) as Promise<RoleRow[]>,
        prisma.department.findMany({ orderBy: { name: "asc" } }) as Promise<DepartmentRow[]>,
        prisma.store.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }) as Promise<StoreRow[]>
      ]);

  const sortedRoles = [...roles].sort(roleSort);
  const activeUsers = users.filter((item) => item.isActive);
  const inactiveUsers = users.filter((item) => !item.isActive);
  const groupedUsers = ["經營管理", "總公司部門", "品牌與館別", "其他"].map((group) => ({
    group,
    users: activeUsers.filter((item) => classifyUser(item) === group)
  })).filter((group) => group.users.length > 0);
  const defaultRole = sortedRoles.find((role) => role.key === "STAFF") ?? sortedRoles[0];

  return (
    <>
      <PageHeader
        title="使用者與權限管理"
        description="新進人員從這裡開帳號；離職人員請停用帳號保留紀錄；權限依總公司、部門與館別調整。"
        actions={<LinkButton href="/settings/roles-permissions" variant="secondary"><ShieldCheck className="h-5 w-5" />查看角色權限表</LinkButton>}
      />

      {searchParams?.status && statusMessage[searchParams.status] ? (
        <p className="mb-5 rounded-lg border border-brand-200 bg-brand-50 px-5 py-4 text-lg font-black text-brand-900">{statusMessage[searchParams.status]}</p>
      ) : null}

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <Panel><p className="text-base font-black text-slate-600">在職帳號</p><p className="mt-2 text-4xl font-black text-slate-950">{activeUsers.length}</p></Panel>
        <Panel><p className="text-base font-black text-slate-600">停用帳號</p><p className="mt-2 text-4xl font-black text-slate-950">{inactiveUsers.length}</p></Panel>
        <Panel><p className="text-base font-black text-slate-600">部門數</p><p className="mt-2 text-4xl font-black text-slate-950">{departments.length}</p></Panel>
        <Panel><p className="text-base font-black text-slate-600">門市 / 館別</p><p className="mt-2 text-4xl font-black text-slate-950">{stores.length}</p></Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="grid gap-5">
          <Panel>
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-black text-slate-950"><UserPlus className="h-6 w-6 text-brand-700" />新進人員開帳號</h2>
            <form action="/api/admin/users" method="post" className="grid gap-4">
              <input type="hidden" name="action" value="CREATE" />
              <Field label="姓名"><input name="name" required placeholder="例如：王小明" /></Field>
              <Field label="登入 Email"><input name="email" type="email" required placeholder="例如：name@huangxiang.local" /></Field>
              <Field label="初始密碼"><input name="password" type="password" defaultValue="aaaa8888" required /></Field>
              <Field label="角色 / 權限等級">
                <select name="roleId" required defaultValue={defaultRole?.id}>
                  {sortedRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              </Field>
              <Field label="所屬部門">
                <select name="departmentId">
                  <option value="">未指定</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </Field>
              <Field label="所屬門市 / 館別">
                <select name="storeId">
                  <option value="">未指定</option>
                  {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
                </select>
              </Field>
              <Button type="submit" className="min-h-14 text-lg"><UserPlus className="h-5 w-5" />建立並啟用帳號</Button>
            </form>
          </Panel>

          <Panel>
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-black text-slate-950"><Building2 className="h-6 w-6 text-brand-700" />總公司結構</h2>
            <div className="grid gap-3">
              {structureGroups.map((group) => (
                <div key={group.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-lg font-black text-slate-950">{group.title}</p>
                  <p className="mt-2 text-base font-semibold leading-7 text-slate-700">{group.names.slice(0, 8).join("、")}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-black text-slate-950"><Store className="h-6 w-6 text-brand-700" />新增部門 / 門市</h2>
            <div className="grid gap-4">
              <form action="/api/admin/departments" method="post" className="grid gap-3 rounded-lg border border-slate-200 p-4">
                <Field label="部門名稱"><input name="name" required placeholder="例如：客服部門" /></Field>
                <Button type="submit" variant="secondary">新增部門</Button>
              </form>
              <form action="/api/admin/stores" method="post" className="grid gap-3 rounded-lg border border-slate-200 p-4">
                <Field label="門市 / 館別名稱"><input name="name" required placeholder="例如：台南門市" /></Field>
                <Field label="品牌"><input name="brand" placeholder="好腳舍 / EFS" /></Field>
                <Field label="所屬部門">
                  <select name="departmentId">
                    <option value="">未指定</option>
                    {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                </Field>
                <Button type="submit" variant="secondary">新增門市 / 館別</Button>
              </form>
            </div>
          </Panel>
        </div>

        <div className="grid gap-5">
          {groupedUsers.map((group) => (
            <Panel key={group.group}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-black text-slate-950">{group.group}</h2>
                <StatusBadge label={`${group.users.length} 人`} tone="blue" />
              </div>
              <div className="grid gap-3">
                {group.users.map((item) => (
                  <UserCard key={item.id} item={item} roles={sortedRoles} departments={departments} stores={stores} currentUserId={currentUser.id} />
                ))}
              </div>
            </Panel>
          ))}

          <Panel>
            <details>
              <summary className="cursor-pointer list-none text-2xl font-black text-slate-950">
                離職 / 停用帳號 ({inactiveUsers.length})
              </summary>
              <p className="mt-2 text-base font-semibold text-slate-600">停用帳號不能登入，但會保留歷史簽呈、任務、稽核與操作紀錄。</p>
              <div className="mt-4 grid gap-3">
                {inactiveUsers.length === 0 ? <p className="rounded-lg bg-slate-50 p-5 text-lg font-bold text-slate-600">目前沒有停用帳號。</p> : null}
                {inactiveUsers.map((item) => (
                  <UserCard key={item.id} item={item} roles={sortedRoles} departments={departments} stores={stores} currentUserId={currentUser.id} />
                ))}
              </div>
            </details>
          </Panel>
        </div>
      </div>
    </>
  );
}
