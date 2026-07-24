import { ApprovalMode, ApprovalType } from "@prisma/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Crown, FilePenLine, Paperclip, PenLine, Route, UserRound } from "lucide-react";
import { AndroidDateInput } from "@/components/android-date-input";
import { AndroidSelectInput } from "@/components/android-select-input";
import { ApplicantSignaturePad } from "@/components/applicant-signature-pad";
import { ApprovalSubmitButton } from "@/components/approval-submit-button";
import { FileInputPreview } from "@/components/file-input-preview";
import { Field, PageHeader, Panel } from "@/components/ui";
import { approvalTypeLabels, roleLabels } from "@/lib/labels";
import { unitValue, visibleUnitOptions } from "@/lib/org-options";
import { prisma } from "@/lib/prisma";
import { canCreateApprovals, canViewAllBusinessData } from "@/lib/rbac";
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
  MIXED: "打勾確認 + 電子手寫簽名"
};

const approvalTemplates = [
  "部門協作：請寫清楚要請哪個部門協助、希望完成什麼、期限與交付方式",
  "總公司決策：請寫清楚背景、影響範圍、可選方案與建議核准方向",
  "會計請款 / 核銷：請寫清楚費用用途、金額、付款對象、附件單據與希望付款日期",
  "行政採購 / 維修：請寫清楚品項或設備、目前狀況、影響工作、預估金額與希望完成日期",
  "人事訓練 / 人員異動：請寫清楚人員姓名、原因、影響班表或權限、希望生效日期",
  "美工設計需求：請寫清楚尺寸、用途、文案、素材來源、交件日期與需不需要印刷",
  "自媒體拍攝 / 發文：請寫清楚拍攝主題、館別、素材、發布平台、腳本重點與上線時間",
  "建設工程 / 現場改善：請寫清楚地點、現況、照片附件、預估工期、廠商與驗收標準",
  "館別現場問題：請寫清楚館別、發生時間、影響客人或同仁的程度、已先做的處理"
];

const approvalFlowOptions = [
  {
    value: "DEPARTMENT_ONLY",
    label: "部門對部門簽核，不送總經理",
    description: "適合一般部門協作，例如美工、行政、人事、自媒體、會計、建設之間確認。"
  },
  {
    value: "MANAGER_THEN_GM",
    label: "相關部門主管簽核後，再送總經理",
    description: "適合需要總經理最後決策的金額、政策、採購、重大客訴或跨部門事項。"
  },
  {
    value: "GM_THEN_HANDLER",
    label: "總經理簽核後，再交承辦部門處理",
    description: "適合總經理核准後，仍需交由特助、會計、採購、行政或其他部門執行。"
  }
] as const;

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
  return user.department?.name ?? user.departmentName ?? "未指定部門";
}

function roleLabel(user: { role?: { name?: string | null; key?: string | null } | null; roleName?: string | null }) {
  const key = user.role?.key as keyof typeof roleLabels | undefined;
  return user.role?.name ?? user.roleName ?? (key ? roleLabels[key] : "簽核人");
}

function approverOptionLabel(manager: ApproverOption) {
  return `${manager.name}（${roleLabel(manager)} / ${departmentLabel(manager)}）`;
}

function approverSelectOption(manager: ApproverOption, currentUserId: string) {
  const isSelf = manager.id === currentUserId;
  return {
    value: manager.id,
    label: `${approverOptionLabel(manager)}${isSelf ? "（自己，已完成申請人簽名，不可選）" : ""}`,
    disabled: isSelf
  };
}

function groupedApprovers(managers: ApproverOption[]) {
  const groups = new Map<string, ApproverOption[]>();
  for (const manager of managers) {
    const label = departmentLabel(manager);
    groups.set(label, [...(groups.get(label) ?? []), manager]);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, "zh-Hant"));
}

function SectionTitle({ icon: Icon, title, description }: { icon: typeof FilePenLine; title: string; description?: string }) {
  return (
    <div className="mb-5 flex min-w-0 items-start gap-3">
      <span className="mt-1 h-7 w-1.5 rounded-full bg-brand-600" />
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-1 h-6 w-6 text-brand-700" />
        <div className="min-w-0">
          <h2 className="text-2xl font-black text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-base font-semibold text-slate-600">{description}</p> : null}
        </div>
      </div>
    </div>
  );
}

export default async function NewApprovalPage() {
  const user = await requireUser();
  if (!canCreateApprovals(user)) {
    redirect("/approvals/progress");
  }
  const canSeeAll = canViewAllBusinessData(user);

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
          where: canSeeAll ? { isActive: true } : user.storeId ? { id: user.storeId, isActive: true } : { id: "__NO_STORE__" },
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
        prisma.user.findMany({ where: { isActive: true, role: { key: "GENERAL_MANAGER" } }, include: { role: true, department: true }, orderBy: { name: "asc" } })
      ]);

  const firstRecipients = ([...managers, ...generalManagers] as ApproverOption[]).sort((a, b) => {
    const departmentCompare = departmentLabel(a).localeCompare(departmentLabel(b), "zh-Hant");
    return departmentCompare || a.name.localeCompare(b.name, "zh-Hant");
  });
  const unitOptions = visibleUnitOptions(departments, stores);
  const defaultUnitValue = user.storeId ? unitValue("store", user.storeId) : user.departmentId ? unitValue("department", user.departmentId) : "";
  const unitSelectOptions = [
    { value: "", label: "請選擇單位" },
    ...unitOptions.map((unit) => ({ value: unit.value, label: unit.name }))
  ];
  const approvalTypeOptions = Object.values(ApprovalType).map((type) => ({
    value: type,
    label: approvalTypeLabels[type]
  }));
  const approvalModeOptions = Object.values(ApprovalMode).map((mode) => ({
    value: mode,
    label: approvalModeLabels[mode]
  }));
  const templateOptions = [
    { value: "", label: "不使用範本" },
    ...approvalTemplates.map((template) => ({ value: template, label: template }))
  ];
  const firstApproverOptions = [
    { value: "", label: "請選擇送出後第一位收到的人" },
    ...firstRecipients.map((recipient) => approverSelectOption(recipient, user.id))
  ];
  const secondApproverOptions = [
    { value: "", label: "不送總經理 / 不需要第二關" },
    ...generalManagers.map((gm) => ({
      value: gm.id,
      label: `${gm.name}（${roleLabel(gm)}）${gm.id === user.id ? "（自己，不可選）" : ""}`,
      disabled: gm.id === user.id
    }))
  ];
  const finalHandlerOptions = [
    { value: "", label: "不指定承辦人" },
    ...managers.map((manager) => approverSelectOption(manager, user.id))
  ];

  return (
    <>
      <PageHeader
        title="填寫簽呈"
        description="填好內容，確認送給誰。"
      />

      <form action="/api/approvals" method="post" encType="multipart/form-data" className="grid gap-5 pb-8">
        <Panel>
          <SectionTitle icon={FilePenLine} title="你要申請什麼？" description="先寫重點，像發訊息一樣簡單。" />
          <div className="grid gap-4">
            <Field label="你要申請什麼？">
              <input name="subject" required placeholder="例：屏東館牆面滲水改善" />
            </Field>
            <Field label="請簡單說明原因">
              <textarea
                name="description"
                required
                rows={4}
                placeholder="例：櫃台後方牆面連續滲水，影響現場觀感與收納安全。"
              />
            </Field>
            <Field label="希望怎麼處理？">
              <textarea
                name="solution"
                required
                rows={4}
                placeholder="例：請建設部聯繫廠商勘查，確認報價後回覆。"
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="是否有金額？">
                <input name="amount" inputMode="numeric" placeholder="無金額可留空，例如：8600" />
              </Field>
              <Field label="申請日期">
                <AndroidDateInput name="applicationDate" defaultValue={new Date().toISOString().slice(0, 10)} />
              </Field>
            </div>
          </div>

          <details className="mt-5 rounded-lg border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer px-4 py-3 text-base font-black text-slate-900">填寫範例</summary>
            <div className="grid gap-3 border-t border-slate-200 p-4">
              <Field label="選一個範例">
                <AndroidSelectInput name="templateHint" options={templateOptions} defaultValue="" />
              </Field>
              <p className="text-sm font-semibold leading-6 text-slate-600">
                範例只幫你抓方向，送出前請改成自己的實際狀況。
              </p>
            </div>
          </details>
        </Panel>

        <Panel>
          <SectionTitle icon={Paperclip} title="上傳照片 / PDF / 文件" description="可上傳佐證資料。" />
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="照片">
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <FileInputPreview name="photos" accept="image/*" note="可先預覽照片。" />
              </div>
            </Field>
            <Field label="PDF">
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <FileInputPreview name="attachments" accept="application/pdf" note="可上傳 PDF。" />
              </div>
            </Field>
            <Field label="其他文件">
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <FileInputPreview name="documents" note="可上傳 Word、Excel 或其他文件。" />
              </div>
            </Field>
          </div>
        </Panel>

        <Panel>
          <SectionTitle icon={Route} title="這張簽呈會送給誰？" description="先選第一位收到的人。" />
          <div className="grid gap-4">
            <Field label="送給誰？">
              <AndroidSelectInput name="firstApproverId" options={firstApproverOptions} defaultValue="" required />
            </Field>
          </div>

          <details className="mt-5 rounded-lg border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer px-4 py-3 text-base font-black text-slate-900">查看簽核流程</summary>
            <div className="grid gap-4 border-t border-slate-200 p-4">
              <p className="text-sm font-semibold leading-6 text-slate-600">需要總經理或承辦人時，再展開設定。</p>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="是否送總經理？">
                  <AndroidSelectInput name="secondApproverId" options={secondApproverOptions} defaultValue="" />
                </Field>
                <Field label="核准後交給誰？">
                  <AndroidSelectInput name="finalHandlerId" options={finalHandlerOptions} defaultValue="" />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {approvalFlowOptions.map((option) => (
                  <div key={option.value} className="rounded-lg border border-brand-100 bg-white p-4">
                    <p className="flex items-center gap-2 text-base font-black text-brand-900">
                      {option.value === "DEPARTMENT_ONLY" ? <UserRound className="h-5 w-5" /> : option.value === "MANAGER_THEN_GM" ? <Crown className="h-5 w-5" /> : <Route className="h-5 w-5" />}
                      {option.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{option.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </Panel>

        <Panel>
          <SectionTitle icon={PenLine} title="申請人簽名" description="送出前請簽名。" />
          <ApplicantSignaturePad />
        </Panel>

        <details className="rounded-lg border border-slate-200 bg-white">
          <summary className="cursor-pointer px-5 py-4 text-lg font-black text-slate-950">進階設定</summary>
          <div className="grid gap-4 border-t border-slate-200 p-5 md:grid-cols-2 xl:grid-cols-3">
            <Field label="所屬單位">
              <AndroidSelectInput name={canSeeAll ? "unitId" : "unitDisplay"} options={unitSelectOptions} defaultValue={defaultUnitValue} disabled={!canSeeAll} />
              {!canSeeAll && user.departmentId ? <input type="hidden" name="departmentId" value={user.departmentId} /> : null}
              {user.storeName ? <p className="mt-2 text-sm font-bold text-slate-500">門市：{user.storeName}</p> : null}
              {user.storeId ? <input type="hidden" name="storeId" value={user.storeId} /> : null}
            </Field>
            <Field label="申請人">
              <input name="applicantName" defaultValue={user.name ?? ""} readOnly />
            </Field>
            <Field label="職位">
              <input name="position" placeholder="例：主管、專員、櫃台人員" />
            </Field>
            <Field label="類型">
              <AndroidSelectInput name="type" options={approvalTypeOptions} defaultValue={ApprovalType.OTHER} required />
            </Field>
            <Field label="簽核方式">
              <AndroidSelectInput name="approvalMode" options={approvalModeOptions} defaultValue={ApprovalMode.MIXED} required />
            </Field>
          </div>
        </details>

        <Panel>
          <p className="text-base font-black text-slate-950">送出前確認</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">請確認內容、附件、送出對象與簽名都正確。</p>
        </Panel>

        <div className="grid gap-3 rounded-lg border border-brand-100 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)] md:flex md:justify-end md:border-0 md:bg-transparent md:p-0 md:shadow-none">
          <Link href="/approvals/progress" className="inline-flex min-h-14 items-center justify-center rounded-lg border border-brand-700 px-8 text-xl font-black text-brand-800 transition hover:bg-brand-50">
            返回
          </Link>
          <ApprovalSubmitButton />
        </div>
      </form>
    </>
  );
}
