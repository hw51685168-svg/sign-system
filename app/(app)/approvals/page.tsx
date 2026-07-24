import { Plus, Search } from "lucide-react";
import { ApprovalStatus, ApprovalType } from "@prisma/client";
import { EmptyState, LinkButton, PageHeader, Panel, StatusBadge, statusTone } from "@/components/ui";
import { approvalStatusLabels, approvalTypeLabels, formatAmount, formatDateTime, safeText } from "@/lib/labels";
import { parseUnitValue, visibleUnitOptions } from "@/lib/org-options";
import { approvalKeywordWhere } from "@/lib/approval-search";
import { prisma } from "@/lib/prisma";
import { canCreateApprovals, canViewAllBusinessData, dataScope, scopedApprovalWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

const statusFilterMap: Record<string, ApprovalStatus[]> = {
  pending: ["SUBMITTED", "REVIEWING"],
  revision: ["NEEDS_REVISION"],
  approved: ["APPROVED"],
  rejected: ["REJECTED"],
  closed: ["CLOSED"]
};

function userUnitLabel(user?: { department?: { name: string } | null; store?: { name: string } | null; role?: { name: string } | null } | null) {
  return safeText(user?.department?.name ?? user?.store?.name ?? user?.role?.name, "未指定單位");
}

function currentStepText(step?: {
  stepOrder: number;
  title: string;
  approver?: { name: string; department?: { name: string } | null; store?: { name: string } | null; role?: { name: string } | null } | null;
} | null) {
  if (!step) return "尚未建立簽核流程";
  return `第 ${step.stepOrder} 關：${step.title} · ${userUnitLabel(step.approver)} · ${safeText(step.approver?.name, "未指定簽核人")}`;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ApprovalsPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; status?: string; applicantId?: string; departmentId?: string; unitId?: string; type?: string }>;
}) {
  const parsedSearchParams = (await searchParams) ?? {};
  const user = await requireUser();
  const q = parsedSearchParams.q?.trim();
  const status = parsedSearchParams.status ?? "";
  const canSeeAll = canViewAllBusinessData(user);
  const canCreateApproval = canCreateApprovals(user);
  const scope = dataScope(user);
  const unitFilter = parseUnitValue(parsedSearchParams.unitId);

  const approvals = await prisma.approvalRequest.findMany({
    where: {
      AND: [
        scopedApprovalWhere(user),
        approvalKeywordWhere(q),
        status && statusFilterMap[status] ? { status: { in: statusFilterMap[status] } } : {},
        parsedSearchParams.applicantId ? { applicantId: parsedSearchParams.applicantId } : {},
        unitFilter ? (unitFilter.type === "department" ? { departmentId: unitFilter.id } : { storeId: unitFilter.id }) : parsedSearchParams.departmentId ? { departmentId: parsedSearchParams.departmentId } : {},
        parsedSearchParams.type ? { type: parsedSearchParams.type as ApprovalType } : {}
      ]
    },
    include: {
      applicant: true,
      department: true,
      store: true,
      steps: {
        include: {
          approver: { include: { department: true, store: true, role: true } }
        },
        orderBy: { stepOrder: "asc" }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  const [departments, stores, applicants] = await Promise.all([
    prisma.department.findMany({
      where: canSeeAll ? {} : user.departmentId ? { id: user.departmentId } : { id: "__NO_DEPARTMENT__" },
      orderBy: { name: "asc" }
    }),
    prisma.store.findMany({
      where: canSeeAll ? { isActive: true } : user.storeId ? { id: user.storeId, isActive: true } : { id: "__NO_STORE__" },
      orderBy: { name: "asc" }
    }),
    prisma.user.findMany({
      where: canSeeAll
        ? { isActive: true }
        : scope === "STORE" && user.storeId
          ? { isActive: true, storeId: user.storeId }
          : { id: user.id },
      orderBy: { name: "asc" }
    })
  ]);
  const unitOptions = visibleUnitOptions(departments, stores);

  return (
    <>
      <PageHeader
        title="簽呈中心"
        description="追蹤你有權限查看的簽呈、目前簽核關卡與主管處理狀態。"
        actions={canCreateApproval ? <LinkButton href="/approvals/new"><Plus className="h-5 w-5" />新增簽呈</LinkButton> : null}
      />

      <Panel className="mb-5">
        <form className="grid gap-3 lg:grid-cols-[1.5fr_repeat(4,1fr)_auto]" action="/approvals">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
            <input className="w-full pl-10" name="q" defaultValue={q} placeholder="搜尋簽呈標題或編號" />
          </div>
          <select name="status" defaultValue={status}>
            <option value="">全部狀態</option>
            <option value="pending">待審核</option>
            <option value="revision">退回補件</option>
            <option value="approved">已核准</option>
            <option value="rejected">已駁回</option>
            <option value="closed">已結案</option>
          </select>
          <select name="applicantId" defaultValue={parsedSearchParams.applicantId ?? ""}>
            <option value="">全部申請人</option>
            {applicants.map((applicant) => <option key={applicant.id} value={applicant.id}>{applicant.name}</option>)}
          </select>
          <select name="unitId" defaultValue={parsedSearchParams.unitId ?? ""}>
            <option value="">全部單位</option>
            {unitOptions.map((unit) => <option key={unit.value} value={unit.value}>{unit.name}</option>)}
          </select>
          <select name="type" defaultValue={parsedSearchParams.type ?? ""}>
            <option value="">全部類型</option>
            {Object.entries(approvalTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <button className="min-h-12 rounded-md bg-brand-700 px-5 text-base font-bold text-white" type="submit">篩選</button>
        </form>
      </Panel>

      {approvals.length === 0 ? (
        <EmptyState title="沒有符合條件的簽呈" description="請調整搜尋或篩選條件，或建立新的簽呈。" />
      ) : (
        <div className="grid gap-4">
          {approvals.map((approval) => {
            const currentStep = approval.steps.find((step) => !step.isCompleted) ?? approval.steps[approval.steps.length - 1];
            return (
              <a key={approval.id} href={`/approvals/${approval.id}`} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft transition hover:border-brand-300 hover:bg-brand-50">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold text-slate-500">{approval.requestNo}</p>
                    <h2 className="mt-1 text-2xl font-black text-slate-950">{safeText(approval.subject, "未命名簽呈")}</h2>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-base text-slate-700">
                      <span>申請人：<strong>{safeText(approval.applicant.name)}</strong></span>
                      <span>申請單位：<strong>{safeText(approval.department?.name ?? approval.store?.name, "未指定")}</strong></span>
                      <span>類型：<strong>{approvalTypeLabels[approval.type]}</strong></span>
                      <span>金額：<strong>{formatAmount(approval.amount)}</strong></span>
                    </div>
                    <p className="mt-2 text-base font-semibold text-slate-700">
                      目前處理位置：{currentStepText(currentStep)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">送出 / 更新：{formatDateTime(approval.createdAt)} / {formatDateTime(approval.updatedAt)}</p>
                  </div>
                  <StatusBadge label={approvalStatusLabels[approval.status]} tone={statusTone(approval.status)} />
                </div>
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}
