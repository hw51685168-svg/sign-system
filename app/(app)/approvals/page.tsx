import { Plus, Search } from "lucide-react";
import { ApprovalStatus, ApprovalType } from "@prisma/client";
import { EmptyState, LinkButton, PageHeader, Panel, StatusBadge, statusTone } from "@/components/ui";
import { approvalStatusLabels, approvalTypeLabels, formatAmount, formatDateTime, safeText } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { canViewAllBusinessData, dataScope, scopedApprovalWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

const statusFilterMap: Record<string, ApprovalStatus[]> = {
  pending: ["SUBMITTED", "REVIEWING"],
  revision: ["NEEDS_REVISION"],
  approved: ["APPROVED"],
  rejected: ["REJECTED"],
  closed: ["CLOSED"]
};

export default async function ApprovalsPage({
  searchParams
}: {
  searchParams: { q?: string; status?: string; applicantId?: string; departmentId?: string; type?: string };
}) {
  const user = await requireUser();
  const q = searchParams.q?.trim();
  const status = searchParams.status ?? "";
  const canSeeAll = canViewAllBusinessData(user);
  const scope = dataScope(user);

  const approvals = await prisma.approvalRequest.findMany({
    where: {
      AND: [
        scopedApprovalWhere(user),
        q ? { OR: [{ subject: { contains: q, mode: "insensitive" } }, { requestNo: { contains: q, mode: "insensitive" } }] } : {},
        status && statusFilterMap[status] ? { status: { in: statusFilterMap[status] } } : {},
        searchParams.applicantId ? { applicantId: searchParams.applicantId } : {},
        searchParams.departmentId ? { departmentId: searchParams.departmentId } : {},
        searchParams.type ? { type: searchParams.type as ApprovalType } : {}
      ]
    },
    include: {
      applicant: true,
      department: true,
      store: true,
      steps: { include: { approver: true }, orderBy: { stepOrder: "asc" } }
    },
    orderBy: { updatedAt: "desc" }
  });

  const [departments, applicants] = await Promise.all([
    prisma.department.findMany({
      where: canSeeAll ? {} : user.departmentId ? { id: user.departmentId } : { id: "__NO_DEPARTMENT__" },
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

  return (
    <>
      <PageHeader
        title="簽呈中心"
        description="追蹤你有權限查看的簽呈、目前簽核關卡與主管處理狀態。"
        actions={<LinkButton href="/approvals/new"><Plus className="h-5 w-5" />新增簽呈</LinkButton>}
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
          <select name="applicantId" defaultValue={searchParams.applicantId ?? ""}>
            <option value="">全部申請人</option>
            {applicants.map((applicant) => <option key={applicant.id} value={applicant.id}>{applicant.name}</option>)}
          </select>
          <select name="departmentId" defaultValue={searchParams.departmentId ?? ""}>
            <option value="">全部部門</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <select name="type" defaultValue={searchParams.type ?? ""}>
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
                      <span>部門：<strong>{safeText(approval.department?.name, "未指定")}</strong></span>
                      <span>類型：<strong>{approvalTypeLabels[approval.type]}</strong></span>
                      <span>金額：<strong>{formatAmount(approval.amount)}</strong></span>
                    </div>
                    <p className="mt-2 text-base font-semibold text-slate-700">
                      目前關卡：{currentStep ? `第 ${currentStep.stepOrder} 關 ${currentStep.title} · ${safeText(currentStep.approver?.name, "未指定簽核人")}` : "尚未建立"}
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
