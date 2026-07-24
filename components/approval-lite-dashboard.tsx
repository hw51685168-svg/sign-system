import { Bell, CheckCircle2, ClipboardList, FileCheck2, PencilLine, TrendingUp, Undo2 } from "lucide-react";
import type { ComponentType } from "react";
import type { CurrentUser } from "@/lib/rbac";
import { LinkButton, Panel, StatusBadge, statusTone } from "@/components/ui";
import { approvalStageLabel } from "@/lib/approval-lite";
import { approvalStatusLabels, formatDateTime, safeText } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { isDepartmentManager, scopedApprovalWhere, scopedTaskWhere } from "@/lib/rbac";

type ActionTone = "green" | "white" | "orange";

function ActionCard({
  href,
  label,
  helper,
  count,
  icon: Icon,
  tone = "white"
}: {
  href: string;
  label: string;
  helper: string;
  count?: number;
  icon: ComponentType<{ className?: string }>;
  tone?: ActionTone;
}) {
  const isGreen = tone === "green";
  const isOrange = tone === "orange";

  return (
    <a
      href={href}
      className={[
        "group flex min-h-48 flex-col justify-between rounded-lg border p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(15,23,42,0.12)]",
        isGreen ? "border-brand-700 bg-brand-700 text-white" : "border-white/80 bg-white/92 text-slate-950",
        isOrange ? "border-orange-200" : ""
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <span className={[
          "flex h-16 w-16 items-center justify-center rounded-full",
          isGreen ? "bg-white/15 text-white" : isOrange ? "bg-orange-100 text-orange-700" : "bg-brand-50 text-brand-700"
        ].join(" ")}>
          <Icon className="h-8 w-8" />
        </span>
        {typeof count === "number" && count > 0 ? (
          <span className={["rounded-full px-3 py-1 text-base font-black", isGreen ? "bg-white text-brand-800" : "bg-red-600 text-white"].join(" ")}>
            {count}
          </span>
        ) : null}
      </div>
      <div>
        <h2 className="text-4xl font-black leading-tight">{label}</h2>
        <p className={["mt-3 text-base font-medium leading-8", isGreen ? "text-white/80" : "text-slate-500"].join(" ")}>{helper}</p>
        <span className={[
          "mt-5 inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-lg font-black transition group-hover:translate-x-1",
          isGreen ? "bg-white text-brand-800" : isOrange ? "bg-orange-600 text-white" : "bg-brand-700 text-white"
        ].join(" ")}>
          前往
        </span>
      </div>
    </a>
  );
}

function StatPill({ label, value, href, urgent = false }: { label: string; value: number; href: string; urgent?: boolean }) {
  return (
    <a
      href={href}
      className="group block rounded-lg border border-slate-200 bg-white/85 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50 hover:shadow-md active:translate-y-px"
      aria-label={`${label}：${value}，點擊查看`}
    >
      <p className="text-base font-black text-slate-700">{label}</p>
      <p className={["mt-1 text-4xl font-black leading-none", urgent && value > 0 ? "text-red-700" : "text-brand-800"].join(" ")}>{value}</p>
      <p className="mt-1 text-sm font-bold text-brand-700 opacity-0 transition group-hover:opacity-100">點擊查看</p>
    </a>
  );
}

export async function ApprovalLiteDashboard({ user }: { user: CurrentUser }) {
  const approvalWhere = scopedApprovalWhere(user);
  const taskWhere = scopedTaskWhere(user);
  const isGm = user.roleKey === "GENERAL_MANAGER";
  const isAdmin = user.roleKey === "SYSTEM_ADMIN";
  const isManager = isDepartmentManager(user.roleKey) || user.roleKey === "BRANCH_MANAGER" || user.roleKey === "EXECUTIVE_ASSISTANT";

  const [
    myRevision,
    mySubmitted,
    unreadNotifications,
    pendingForMe,
    reviewing,
    rejectedOrRevision,
    gmTasksWaiting,
    gmTasksProgress,
    recentApprovals
  ] = await Promise.all([
    prisma.approvalRequest.count({ where: { applicantId: user.id, status: "NEEDS_REVISION" } }),
    prisma.approvalRequest.count({ where: { applicantId: user.id, status: { in: ["SUBMITTED", "REVIEWING"] } } }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    prisma.approvalRequest.count({ where: { AND: [approvalWhere, { status: "REVIEWING", steps: { some: { approverId: user.id, isCompleted: false } } }] } }),
    prisma.approvalRequest.count({ where: { AND: [approvalWhere, { status: { in: ["SUBMITTED", "REVIEWING"] } }] } }),
    prisma.approvalRequest.count({ where: { AND: [approvalWhere, { status: { in: ["REJECTED", "NEEDS_REVISION"] } }] } }),
    prisma.task.count({ where: { AND: [taskWhere, { sourceType: "gm_assignment", status: { in: ["NOT_STARTED", "WAITING_CONFIRMATION"] } }] } }),
    prisma.task.count({ where: { AND: [taskWhere, { sourceType: "gm_assignment", status: { in: ["IN_PROGRESS", "REJECTED"] } }] } }),
    prisma.approvalRequest.findMany({
      where: approvalWhere,
      include: { applicant: true, department: true, steps: { include: { approver: true }, orderBy: { stepOrder: "asc" } } },
      orderBy: { updatedAt: "desc" },
      take: 5
    })
  ]);

  const title = isGm ? `您好，${safeText(user.name)}！` : isAdmin ? "系統管理工作台" : isManager ? "主管工作台" : `您好，${safeText(user.name)}！`;
  const subtitle = isGm
    ? "請依序查看交辦進度、待我簽核，再建立新的任務派發。"
    : isManager
      ? "快速掌握待審簽呈、部門進度與通知。"
      : "歡迎使用內部電子簽呈系統，請從最常用的工作開始。";

  return (
    <>
      <section className="mb-6 overflow-hidden rounded-lg border border-white/80 bg-white/88 p-6 shadow-[0_16px_42px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-black text-brand-700">
              <FileCheck2 className="h-4 w-4" />
              JU數位管理
            </p>
            <h1 className="mt-4 text-5xl font-black leading-tight text-slate-950">{title}</h1>
            <p className="mt-3 max-w-4xl text-lg font-medium leading-8 text-slate-500">{subtitle}</p>
          </div>
          <div className="hidden min-h-32 min-w-72 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 to-emerald-100 lg:flex">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg">
              <CheckCircle2 className="h-11 w-11" />
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        {isGm ? (
          <>
            <ActionCard href="/gm/tasks" label="交辦進度" helper="先瀏覽全部交辦，再依狀態篩選進度" count={gmTasksWaiting + gmTasksProgress} icon={TrendingUp} tone="green" />
            <ActionCard href="/approvals/progress?view=pending" label="待我簽核" helper="查看需要總經理決策的簽呈" count={pendingForMe} icon={FileCheck2} />
            <ActionCard href="/gm/tasks?new=1#new-gm-task" label="任務派發" helper="建立交辦並指派給部門或人員" icon={ClipboardList} />
          </>
        ) : isManager || isAdmin ? (
          <>
            <ActionCard href="/approvals/progress?view=pending" label="待我審核" helper="處理部門送出的簽呈" count={pendingForMe} icon={FileCheck2} tone="green" />
            <ActionCard href="/approvals/progress" label="部門簽呈進度" helper="查看簽呈目前處理狀態" count={reviewing} icon={TrendingUp} />
            <ActionCard href="/notifications" label="通知" helper="查看退回、核准與系統提醒" count={unreadNotifications} icon={Bell} />
          </>
        ) : (
          <>
            <ActionCard href="/approvals/new" label="填寫簽呈" helper="建立新的簽呈申請流程" icon={PencilLine} tone="green" />
            <ActionCard href="/approvals/progress" label="我的簽呈進度" helper="查看簽呈申請與審核進度" count={mySubmitted} icon={TrendingUp} />
            <ActionCard href="/approvals/progress?filter=revision" label="退回修改" helper="查看退回簽呈並進行修改" count={myRevision} icon={Undo2} tone="orange" />
          </>
        )}
      </section>

      <section className="mb-6 grid gap-3 md:grid-cols-4">
        <StatPill
          label={isGm ? "待簽核" : isManager || isAdmin ? "待審核" : "進行中簽呈"}
          value={isGm || isManager || isAdmin ? pendingForMe : mySubmitted}
          href={isGm || isManager || isAdmin ? "/approvals/progress?view=pending" : "/approvals/progress?filter=reviewing"}
          urgent
        />
        <StatPill label="審核中" value={reviewing} href="/approvals/progress?filter=reviewing" />
        <StatPill label="退回 / 駁回" value={rejectedOrRevision + myRevision} href="/approvals/progress?filter=returned" urgent />
        <StatPill label="未讀通知" value={unreadNotifications} href="/notifications" urgent />
      </section>

      <Panel>
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-black text-slate-950">
              <FileCheck2 className="h-6 w-6 text-brand-700" />
              近期簽呈
            </h2>
            <p className="text-base font-medium text-slate-500">最近更新的簽呈會顯示在這裡，方便快速追蹤。</p>
          </div>
          <LinkButton href="/approvals/progress" variant="secondary">查看全部</LinkButton>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {recentApprovals.map((approval) => (
            <a key={approval.id} href={`/approvals/${approval.id}`} className="block border-b border-slate-100 px-5 py-4 transition last:border-b-0 hover:bg-brand-50">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-2xl font-black text-slate-950">{safeText(approval.subject, "未命名簽呈")}</p>
                  <p className="mt-1 text-sm font-medium text-slate-500 md:text-base">
                    {approval.applicant.name} · {safeText(approval.department?.name, "未指定部門")} · {formatDateTime(approval.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <StatusBadge label={approvalStageLabel(approval)} tone={statusTone(approval.status)} />
                  <StatusBadge label={approvalStatusLabels[approval.status]} tone={statusTone(approval.status)} />
                </div>
              </div>
            </a>
          ))}
          {recentApprovals.length === 0 ? <p className="p-6 text-center text-lg font-bold text-slate-600">目前沒有簽呈資料。</p> : null}
        </div>
      </Panel>
    </>
  );
}
