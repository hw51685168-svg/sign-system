import { Search } from "lucide-react";
import { PageHeader, Panel, StatusBadge, statusTone } from "@/components/ui";
import { approvalProgressFilter, approvalStageLabel, currentApprovalStep } from "@/lib/approval-lite";
import { approvalStatusLabels, formatDateTime, safeText } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { canViewAllBusinessData, scopedApprovalWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

const tabs = [
  { label: "全部", value: "" },
  { label: "審核中", value: "reviewing" },
  { label: "已核准", value: "approved" },
  { label: "退回修改", value: "revision" },
  { label: "已駁回", value: "rejected" }
];

export default async function ApprovalProgressPage({
  searchParams
}: {
  searchParams?: { filter?: string; view?: string; q?: string };
}) {
  const user = await requireUser();
  const filter = searchParams?.filter ?? "";
  const q = searchParams?.q?.trim();
  const view = searchParams?.view ?? "";
  const baseWhere = scopedApprovalWhere(user);

  const approvals = await prisma.approvalRequest.findMany({
    where: {
      AND: [
        baseWhere,
        view === "pending" ? { status: "REVIEWING" as const } : approvalProgressFilter(filter),
        q ? { OR: [{ subject: { contains: q, mode: "insensitive" } }, { requestNo: { contains: q, mode: "insensitive" } }] } : {}
      ]
    },
    include: {
      applicant: true,
      department: true,
      steps: { include: { approver: true }, orderBy: { stepOrder: "asc" } }
    },
    orderBy: { updatedAt: "desc" },
    take: view === "pending" ? 200 : 60
  });
  const visibleApprovals = view === "pending" ? approvals.filter((approval) => currentApprovalStep(approval)?.approverId === user.id) : approvals;

  const canSeeAll = canViewAllBusinessData(user);
  const isGeneralManagerPending = user.roleKey === "GENERAL_MANAGER" && view === "pending";

  return (
    <>
      <PageHeader
        title={isGeneralManagerPending ? "待我簽核" : canSeeAll ? "全部簽呈進度" : view === "pending" ? "待我審核" : "簽呈進度"}
        description="用最簡單方式查看目前關卡、處理人與簽核結果。"
      />

      <Panel className="mb-5">
        <form action="/approvals/progress" className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input type="hidden" name="view" value={view} />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
            <input className="w-full pl-10" name="q" defaultValue={q ?? ""} placeholder="搜尋主題或簽呈編號" />
          </div>
          <button className="min-h-14 rounded-md bg-brand-700 px-6 text-lg font-black text-white" type="submit">搜尋</button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <a
              key={tab.value || "all"}
              href={`/approvals/progress${tab.value ? `?filter=${tab.value}` : ""}`}
              className={`rounded-md px-5 py-3 text-lg font-black ${filter === tab.value ? "bg-brand-700 text-white" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}
            >
              {tab.label}
            </a>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4">
        {visibleApprovals.map((approval) => {
          const currentStep = approval.steps.find((step) => !step.isCompleted) ?? approval.steps[approval.steps.length - 1];
          return (
            <a key={approval.id} href={`/approvals/${approval.id}`} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-brand-300 hover:bg-brand-50">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-black text-slate-500">{approval.requestNo}</p>
                  <h2 className="mt-1 text-2xl font-black leading-9 text-slate-950">{safeText(approval.subject, "未命名簽呈")}</h2>
                  <p className="mt-2 text-lg font-semibold text-slate-700">
                    {approval.applicant.name} · {safeText(approval.department?.name, "未指定")} · 處理人：{safeText(currentStep?.approver?.name, "已完成或未指定")}
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-500">最近更新：{formatDateTime(approval.updatedAt)}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <StatusBadge label={approvalStatusLabels[approval.status]} tone={statusTone(approval.status)} />
                  <StatusBadge label={approvalStageLabel(approval)} tone={statusTone(approval.status)} />
                </div>
              </div>
            </a>
          );
        })}
        {visibleApprovals.length === 0 ? (
          <Panel>
            <p className="text-center text-lg font-bold text-slate-600">目前沒有符合條件的簽呈。</p>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
