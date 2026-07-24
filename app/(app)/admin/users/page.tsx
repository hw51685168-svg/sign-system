import { RoleKey } from "@prisma/client";
import { KeyRound, Power, RotateCcw, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Button, Field, LinkButton, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { visibleDepartmentOptions, visibleStoreOptions } from "@/lib/org-options";
import { prisma } from "@/lib/prisma";
import { canManageSystem } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: { id: string; key: RoleKey; name: string };
  department: { id: string; name: string } | null;
  store: { id: string; name: string } | null;
  isActive: boolean;
  lastLoginAt: Date | null;
};

type RoleRow = { id: string; key: RoleKey; name: string };
type DepartmentRow = { id: string; name: string };
type StoreRow = { id: string; name: string };

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
  "STORE_REQUESTER",
  "STORE_STAFF",
  "TESTER"
];

const statusMessage: Record<string, string> = {
  created: "帳號已建立。",
  updated: "帳號資料已更新。",
  deactivated: "帳號已停用。",
  reactivated: "帳號已重新啟用。",
  "password-reset": "密碼已重設。",
  "cannot-deactivate-self": "不能停用目前登入中的自己。"
};

function roleSort(a: RoleRow, b: RoleRow) {
  return roleOrder.indexOf(a.key) - roleOrder.indexOf(b.key);
}

function formatDate(value: Date | null) {
  if (!value) return "尚未登入";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
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
    <Panel className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-black text-slate-950">{item.name}</h3>
            <StatusBadge label={item.isActive ? "啟用" : "停用"} tone={item.isActive ? "green" : "slate"} />
            {isSelf ? <StatusBadge label="目前帳號" tone="blue" /> : null}
          </div>
          <p className="mt-1 break-all text-base font-semibold text-slate-600">{item.email}</p>
          <p className="mt-2 text-lg font-black text-slate-800">{item.role.name}</p>
          <p className="mt-1 text-base font-semibold text-slate-600">
            {item.department?.name ?? "未指定部門"} {item.store?.name ? ` / ${item.store.name}` : ""}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500">最後登入：{formatDate(item.lastLoginAt)}</p>
        </div>
      </div>

      <details className="rounded-lg border border-brand-100 bg-brand-50">
        <summary className="cursor-pointer list-none px-4 py-3 text-lg font-black text-brand-900">
          編輯帳號與權限
        </summary>
        <div className="grid gap-4 border-t border-brand-100 bg-white p-4">
          <form action="/api/admin/users" method="post" className="grid gap-3">
            <input type="hidden" name="action" value="UPDATE" />
            <input type="hidden" name="userId" value={item.id} />
            <Field label="姓名">
              <input name="name" defaultValue={item.name} required />
            </Field>
            <Field label="角色">
              <select name="roleId" defaultValue={item.role.id} required>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="部門">
                <select name="departmentId" defaultValue={item.department?.id ?? ""}>
                  <option value="">未指定</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="門市 / 館別">
                <select name="storeId" defaultValue={item.store?.id ?? ""}>
                  <option value="">未指定</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Button type="submit"><ShieldCheck className="h-4 w-4" />儲存帳號設定</Button>
          </form>

          <form action="/api/admin/users" method="post" className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <input type="hidden" name="action" value="RESET_PASSWORD" />
            <input type="hidden" name="userId" value={item.id} />
            <Field label="新密碼" hint="不要使用共用登入資訊；請為使用者設定個別密碼。">
              <input name="password" type="password" placeholder="請輸入新密碼" required />
            </Field>
            <Button type="submit" variant="secondary"><KeyRound className="h-4 w-4" />重設密碼</Button>
          </form>

          {item.isActive ? (
            <form action="/api/admin/users" method="post">
              <input type="hidden" name="action" value="DEACTIVATE" />
              <input type="hidden" name="userId" value={item.id} />
              <Button type="submit" variant="danger" disabled={isSelf}>
                <Power className="h-4 w-4" />停用帳號
              </Button>
            </form>
          ) : (
            <form action="/api/admin/users" method="post">
              <input type="hidden" name="action" value="REACTIVATE" />
              <input type="hidden" name="userId" value={item.id} />
              <Button type="submit" variant="secondary">
                <RotateCcw className="h-4 w-4" />重新啟用
              </Button>
            </form>
          )}
        </div>
      </details>
    </Panel>
  );
}

export default async function UsersAdminPage({
  searchParams
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const parsedSearchParams = (await searchParams) ?? {};
  const currentUser = await requireUser();
  if (!canManageSystem(currentUser)) {
    return <Panel><p className="text-lg font-semibold text-slate-700">權限不足，無法進入使用者管理。</p></Panel>;
  }

  const [users, roles, departments, stores] = await Promise.all([
    prisma.user.findMany({
      include: { role: true, department: true, store: true },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
    }) as Promise<UserRow[]>,
    prisma.role.findMany({ where: { isActive: true }, orderBy: { key: "asc" } }) as Promise<RoleRow[]>,
    prisma.department.findMany({ orderBy: { name: "asc" } }) as Promise<DepartmentRow[]>,
    prisma.store.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }) as Promise<StoreRow[]>
  ]);
  const departmentOptions = visibleDepartmentOptions(departments);
  const storeOptions = visibleStoreOptions(stores);

  const sortedRoles = [...roles].sort(roleSort);
  const defaultRole = sortedRoles.find((role) => role.key === "STAFF") ?? sortedRoles[0];
  const activeCount = users.filter((user) => user.isActive).length;

  return (
    <>
      <PageHeader
        title="使用者管理"
        description="開設新帳號、調整角色權限、停用離職人員帳號。正式上線前請使用個別密碼，不要使用共用登入資訊。"
        actions={<LinkButton href="/settings/roles-permissions" variant="secondary"><ShieldCheck className="h-5 w-5" />查看權限表</LinkButton>}
      />

      {parsedSearchParams.status && statusMessage[parsedSearchParams.status] ? (
        <p className="mb-5 rounded-lg border border-brand-200 bg-brand-50 px-5 py-4 text-lg font-black text-brand-900">{statusMessage[parsedSearchParams.status]}</p>
      ) : null}

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <Panel><p className="text-base font-black text-slate-600">啟用帳號</p><p className="mt-2 text-4xl font-black text-slate-950">{activeCount}</p></Panel>
        <Panel><p className="text-base font-black text-slate-600">全部帳號</p><p className="mt-2 text-4xl font-black text-slate-950">{users.length}</p></Panel>
        <Panel><p className="text-base font-black text-slate-600">角色數</p><p className="mt-2 text-4xl font-black text-slate-950">{sortedRoles.length}</p></Panel>
        <Panel><p className="text-base font-black text-slate-600">部門 / 門市</p><p className="mt-2 text-4xl font-black text-slate-950">{departmentOptions.length + storeOptions.length}</p></Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Panel>
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-black text-slate-950">
            <UserPlus className="h-6 w-6 text-brand-700" />新增帳號
          </h2>
          <form action="/api/admin/users" method="post" className="grid gap-4">
            <input type="hidden" name="action" value="CREATE" />
            <Field label="姓名"><input name="name" required placeholder="請輸入姓名" /></Field>
            <Field label="登入 Email"><input name="email" type="email" required placeholder="name@huangxiang.local" /></Field>
            <Field label="初始密碼" hint="請設定個別密碼，並提醒使用者首次登入後修改。">
              <input name="password" type="password" placeholder="請輸入初始密碼" required />
            </Field>
            <Field label="角色">
              <select name="roleId" required defaultValue={defaultRole?.id}>
                {sortedRoles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </Field>
            <Field label="部門">
              <select name="departmentId">
                <option value="">未指定</option>
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
            </Field>
            <Field label="門市 / 館別">
              <select name="storeId">
                <option value="">未指定</option>
                {storeOptions.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </Field>
            <Button type="submit" className="min-h-14 text-lg"><UserPlus className="h-5 w-5" />建立帳號</Button>
          </form>
        </Panel>

        <div className="grid gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-brand-700" />
            <h2 className="text-2xl font-black text-slate-950">帳號清單</h2>
          </div>
          {users.map((item) => (
            <UserCard
              key={item.id}
            item={item}
            roles={sortedRoles}
              departments={departmentOptions}
              stores={storeOptions}
              currentUserId={currentUser.id}
            />
          ))}
        </div>
      </div>
    </>
  );
}
