import Link from "next/link";
import { ChevronRight, FilePenLine, Search, TrendingUp } from "lucide-react";

import { PageHeader, Panel, StatusBadge, statusTone } from "@/components/ui";
import { approvalProgressFilter, approvalStageLabel, currentApprovalStep } from "@/lib/approval-lite";
import { approvalStatusLabels, formatDateTime, safeText } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { canViewAllBusinessData, scopedApprovalWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

const tabs = [
  { label: "全部", value: "" },
  { label: "待簽", value: "reviewing" },
  { label: "已簽核", value: "approved" },
  { label: "退回修改", value: "revision" },
  { label: "已駁回", value: "rejected" }
];

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ApprovalProgressPage({
  searchParams
}: {
  searchParams?: Promise<{ filter?: string; view?: string; q?: string }>;
}) {
  const parsedSearchParams = (await searchParams) ?? {};
  const user = await requireUser();
  const filter = parsedSearchParams.filter ?? "";
  const selectedFilter = parsedSearchParams.view ?? filter ?? "";
  const q = parsedSearchParams.q?.trim();
  const view = parsedSearchParams.view ?? "";
  const baseWhere = scopedApprovalWhere(user);

  const approvals = await prisma.approvalRequest.findMany({
    where: {
      AND: [
        baseWhere,
        view === "pending" ? { status: "REVIEWING" as const } : approvalProgressFilter(selectedFilter),
        q
          ? {
              OR: [
                { subject: { contains: q, mode: "insensitive" as const } },
                { requestNo: { contains: q, mode: "insensitive" as const } }
              ]
            }
          : {}
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

  const visibleApprovals =
    view === "pending" ? approvals.filter((approval) => currentApprovalStep(approval)?.approverId === user.id) : approvals;
  const canSeeAll = canViewAllBusinessData(user);
  const isGeneralManagerPending = user.roleKey === "GENERAL_MANAGER" && view === "pending";
  const title = isGeneralManagerPending ? "主管待簽進度" : canSeeAll ? "全部簽呈進度" : "我的簽呈進度";

  return (
    <>
      <PageHeader
        title={title}
        description="可快速查看簽呈進度、追蹤目前審核狀態，並依關鍵字或類別篩選。"
      />

      <Panel className="mb-5">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <TrendingUp className="h-8 w-8" />
            </span>
            <div>
              <h2 className="text-2xl font-black text-slate-950">簽呈總覽</h2>
              <p className="text-base font-semibold text-slate-600">目前共 {visibleApprovals.length} 筆可檢視資料</p>
            </div>
          </div>
          <Link
            href="/approvals/new"
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-700 px-5 text-lg font-black text-white hover:bg-brand-800"
          >
            <FilePenLine className="mr-2 h-5 w-5" />
            新增簽呈
          </Link>
        </div>

        <form action="/approvals/progress" className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input type="hidden" name="view" value={view} />
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input className="w-full pl-12" name="q" defaultValue={q ?? ""} placeholder="輸入主旨或編號" />
          </div>
          <button className="min-h-14 rounded-lg bg-brand-700 px-7 text-lg font-black text-white hover:bg-brand-800" type="submit">搜尋</button>
        </form>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <Link
              key={tab.value || "all"}
              href={`/approvals/progress${tab.value ? `?view=${tab.value}` : ""}`}
              className={[
                "shrink-0 rounded-lg px-5 py-3 text-base font-black transition",
                selectedFilter === tab.value
                  ? "bg-brand-700 text-white shadow-sm"
                  : "border border-slate-300 bg-white text-slate-800 hover:border-brand-200 hover:bg-brand-50"
              ].join(" ")}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4">
        {visibleApprovals.map((approval) => {
          const step = approval.steps.find((item) => !item.isCompleted) ?? approval.steps[approval.steps.length - 1];
          return (
            <Link
              key={approval.id}
              href={`/approvals/${approval.id}`}
              className="group rounded-lg border border-white/80 bg-white/92 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_16px_38px_rgba(15,23,42,0.10)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-black text-slate-500">{approval.requestNo}</p>
                  <h2 className="mt-1 text-2xl font-black leading-9 text-slate-950">{safeText(approval.subject, "未填寫主旨")}</h2>
                  <div className="mt-2 grid gap-1 text-base font-semibold text-slate-600 md:grid-cols-3">
                    <p>申請人：{approval.applicant.name}</p>
                    <p>部門：{safeText(approval.department?.name, "- ")}</p>
                    <p>目前簽核：{safeText(step?.approver?.name, "待自動補位")}</p>
                  </div>
                  <p className="mt-1 text-base font-semibold text-slate-500">更新時間：{formatDateTime(approval.updatedAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <StatusBadge label={approvalStatusLabels[approval.status]} tone={statusTone(approval.status)} />
                    <StatusBadge label={approvalStageLabel(approval)} tone={statusTone(approval.status)} />
                  </div>
                  <ChevronRight className="h-6 w-6 text-slate-400 transition group-hover:translate-x-1 group-hover:text-brand-700" />
                </div>
              </div>
            </Link>
          );
        })}

        {visibleApprovals.length === 0 ? (
          <Panel>
            <p className="text-center text-lg font-bold text-slate-600">目前沒有符合條件的簽呈</p>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
