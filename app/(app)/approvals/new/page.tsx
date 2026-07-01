import { ApprovalMode, ApprovalType } from "@prisma/client";
import { ApprovalSubmitButton } from "@/components/approval-submit-button";
import { Field, PageHeader, Panel } from "@/components/ui";
import { approvalTypeLabels, roleLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { canViewAllBusinessData, dataScope } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { demoDepartments, demoMode, demoStores, demoUsers } from "@/lib/demo";

const approverRoleKeys = [
  "EXECUTIVE_ASSISTANT",
  "ADMIN_MANAGER",
  "ACCOUNTING_MANAGER",
  "DESIGN_MANAGER",
  "SOCIAL_MEDIA_MANAGER",
  "HR_MANAGER",
  "CONSTRUCTION_MANAGER",
  "BRANCH_MANAGER",
  "MANAGER"
] as const;

const approvalModeLabels: Record<ApprovalMode, string> = {
  CHECKBOX: "打勾式簽核",
  HANDWRITTEN: "電子手寫簽名",
  MIXED: "打勾 + 電子手寫簽名"
};

const approvalTemplates = [
  "採購申請：用品、設備、耗材採購",
  "維修申請：門市設備、冷氣、水電、裝潢維修",
  "人事申請：排班、人員異動、教育訓練",
  "美工需求：海報、立牌、菜單、社群素材",
  "自媒體需求：拍攝、剪輯、發布排程",
  "倉管補貨：商品、耗材、備品補貨",
  "客訴處理：客人反映、補償、改善方案",
  "門市異常回報：現場狀況、營運異常、緊急事件",
  "課程或教育訓練申請：訓練時數、講師、教材",
  "其他：請自行補充完整說明"
];

type ApproverOption = {
  id: string;
  name: string;
  departmentId?: string | null;
  department?: { name: string } | null;
  departmentName?: string | null;
  role?: { name?: string | null; key?: string | null } | null;
  roleName?: string | null;
};

function departmentLabel(user: { department?: { name: string } | null; departmentName?: string | null }) {
  return user.department?.name ?? user.departmentName ?? "未指定";
}

function normalizeDepartmentName(value?: string | null) {
  return (value ?? "").replace(/部門|部|室|\s/g, "");
}

function roleLabel(user: { role?: { name?: string | null; key?: string | null } | null; roleName?: string | null }) {
  const key = user.role?.key as keyof typeof roleLabels | undefined;
  return user.role?.name ?? user.roleName ?? (key ? roleLabels[key] : "簽核人");
}

function approverOptionLabel(manager: {
  name: string;
  role?: { name?: string | null; key?: string | null } | null;
  roleName?: string | null;
  department?: { name: string } | null;
  departmentName?: string | null;
}) {
  return `${manager.name}（${roleLabel(manager)} / ${departmentLabel(manager)}）`;
}

function groupedApprovers(managers: ApproverOption[]) {
  const groups = new Map<string, ApproverOption[]>();
  for (const manager of managers) {
    const label = departmentLabel(manager);
    groups.set(label, [...(groups.get(label) ?? []), manager]);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, "zh-Hant"));
}

export default async function NewApprovalPage() {
  const user = await requireUser();
  const canSeeAll = canViewAllBusinessData(user);
  const scope = dataScope(user);
  const [departments, stores, managers, generalManagers] = demoMode
    ? [
        demoDepartments,
        demoStores,
        demoUsers.filter((item) => [...approverRoleKeys].includes(item.role.key as (typeof approverRoleKeys)[number])),
        demoUsers.filter((item) => item.role.key === "GENERAL_MANAGER")
      ]
    : await Promise.all([
        prisma.department.findMany({
          where: canSeeAll ? {} : user.departmentId ? { id: user.departmentId } : { id: "__NO_DEPARTMENT__" },
          orderBy: { name: "asc" }
        }),
        prisma.store.findMany({
          where: canSeeAll ? { isActive: true } : scope === "STORE" && user.storeId ? { id: user.storeId, isActive: true } : { id: "__NO_STORE__" },
          orderBy: { name: "asc" }
        }),
        prisma.user.findMany({
          where: {
            isActive: true,
            role: { key: { in: [...approverRoleKeys] } }
          },
          include: { role: true, department: true, store: true },
          orderBy: [{ department: { name: "asc" } }, { name: "asc" }]
        }),
        prisma.user.findMany({ where: { isActive: true, role: { key: "GENERAL_MANAGER" } }, include: { role: true }, orderBy: { name: "asc" } })
      ]);

  const defaultManager =
    managers.find((item) => item.departmentId === user.departmentId) ??
    managers.find((item) => normalizeDepartmentName(departmentLabel(item)) === normalizeDepartmentName(user.departmentName)) ??
    managers[0];
  const defaultGm = generalManagers[0];
  const managerGroups = groupedApprovers(managers as ApproverOption[]);

  return (
    <>
      <PageHeader title="內部簽呈請示單" description="請依照紙本格式填寫。畫面只保留簽呈需要的欄位。" />

      <form action="/api/approvals" method="post" encType="multipart/form-data" className="grid gap-5">
        <Panel>
          <h2 className="mb-4 text-2xl font-black text-slate-950">基本資料</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="部門">
              <select name="departmentId" defaultValue={user.departmentId ?? ""} disabled={!canSeeAll}>
                <option value="">未指定</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
              {!canSeeAll && user.departmentId ? <input type="hidden" name="departmentId" value={user.departmentId} /> : null}
            </Field>
            <Field label="申請日期">
              <input name="applicationDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label="申請人">
              <input name="applicantName" defaultValue={user.name ?? ""} readOnly />
            </Field>
            <Field label="職位">
              <input name="position" placeholder="例如：行政人員、櫃台、主管" />
            </Field>
            <Field label="所屬門市 / 館別">
              <select name="storeId" defaultValue={user.storeId ?? ""} disabled={!canSeeAll}>
                <option value="">無指定門市</option>
                {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
              </select>
              {!canSeeAll && user.storeId ? <input type="hidden" name="storeId" value={user.storeId} /> : null}
            </Field>
            <Field label="簽呈類型">
              <select name="type" defaultValue={ApprovalType.OTHER} required>
                {Object.values(ApprovalType).map((type) => (
                  <option key={type} value={type}>{approvalTypeLabels[type]}</option>
                ))}
              </select>
            </Field>
            <Field label="簽核方式">
              <select name="approvalMode" defaultValue={ApprovalMode.MIXED} required>
                {Object.values(ApprovalMode).map((mode) => (
                  <option key={mode} value={mode}>{approvalModeLabels[mode]}</option>
                ))}
              </select>
            </Field>
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-black text-slate-950">簽呈內容</h2>
          <div className="grid gap-4">
            <Field label="常用簽呈情境" hint="這是填寫提醒，不會限制你送出的簽呈類型。">
              <select name="templateHint" defaultValue="">
                <option value="">請選擇常見情境</option>
                {approvalTemplates.map((template) => <option key={template} value={template}>{template}</option>)}
              </select>
            </Field>
            <Field label="主題">
              <input name="subject" required placeholder="請用一句話寫清楚本次簽呈主題" />
            </Field>
            <Field label="說明事項">
              <textarea name="description" required rows={7} placeholder="請說明原因、背景、現況或需要主管知道的重點。" />
            </Field>
            <Field label="解決 / 執行方式">
              <textarea name="solution" required rows={7} placeholder="請寫建議怎麼處理、需要哪些資源、預計如何執行。" />
            </Field>
            <Field label="金額">
              <input name="amount" inputMode="numeric" placeholder="沒有金額可留空，例如：18600" />
            </Field>
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-black text-slate-950">附件</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="上傳圖片">
              <input name="photos" type="file" multiple accept="image/*" />
            </Field>
            <Field label="上傳 PDF">
              <input name="attachments" type="file" multiple accept="application/pdf" />
            </Field>
            <Field label="上傳文件">
              <input name="documents" type="file" multiple />
            </Field>
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-black text-slate-950">簽核流程</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="相關部門主管簽核">
              <select name="firstApproverId" defaultValue={defaultManager?.id ?? ""} required>
                <option value="">請選擇相關部門主管</option>
                {managerGroups.map(([departmentName, departmentManagers]) => (
                  <optgroup key={departmentName} label={departmentName}>
                    {departmentManagers.map((manager) => <option key={manager.id} value={manager.id}>{approverOptionLabel(manager)}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="總經理簽核">
              <select name="secondApproverId" defaultValue={defaultGm?.id ?? ""} required>
                <option value="">請選擇總經理</option>
                {generalManagers.map((gm) => <option key={gm.id} value={gm.id}>{gm.name}（{roleLabel(gm)}）</option>)}
              </select>
            </Field>
          </div>
          <p className="mt-4 rounded-lg bg-slate-50 p-4 text-base font-semibold text-slate-700">流程：申請人填寫 → 部門主管審核 → 總經理批示 → 申請人查看結果。</p>
        </Panel>

        <div className="flex justify-end">
          <ApprovalSubmitButton />
        </div>
      </form>
    </>
  );
}
