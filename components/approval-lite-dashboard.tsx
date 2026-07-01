import { Bell, CheckCircle2, ClipboardList, FileCheck2, PencilLine } from "lucide-react";
import type { ComponentType } from "react";
import type { CurrentUser } from "@/lib/rbac";
import { LinkButton, Panel, StatusBadge, statusTone } from "@/components/ui";
import { approvalStageLabel } from "@/lib/approval-lite";
import { approvalStatusLabels, formatDateTime, safeText } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { isDepartmentManager, scopedApprovalWhere, scopedTaskWhere } from "@/lib/rbac";

type ActionTone = "primary" | "plain" | "notice";

function MainAction({
  href,
  label,
  helper,
  count,
  icon: Icon,
  tone = "plain"
}: {
  href: string;
  label: string;
  helper: string;
  count?: number;
  icon: ComponentType<{ className?: string }>;
  tone?: ActionTone;
}) {
  const toneClass =
    tone === "primary"
      ? "border-brand-700 bg-brand-700 text-white hover:bg-brand-800"
      : tone === "notice"
        ? "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100"
        : "border-slate-200 bg-white text-slate-950 hover:border-brand-300 hover:bg-brand-50";

  return (
    <a href={href} className={`block rounded-lg border p-5 transition ${toneClass}`}>
      <div className="flex items-center gap-4">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg ${tone === "primary" ? "bg-white/15" : "bg-slate-100 text-brand-700"}`}>
          <Icon className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <p className="text-2xl font-black leading-tight">{label}</p>
            {typeof count === "number" && count > 0 ? (
              <span className={`rounded-full px-3 py-1 text-base font-black ${tone === "primary" ? "bg-white text-brand-800" : "bg-red-600 text-white"}`}>
                {count}
              </span>
            ) : null}
          </div>
          <p className={`mt-1 text-base font-semibold leading-7 ${tone === "primary" ? "text-white/90" : "text-slate-600"}`}>{helper}</p>
        </div>
      </div>
    </a>
  );
}

function FocusItem({ label, value, href, urgent = false }: { label: string; value: number; href: string; urgent?: boolean }) {
  return (
    <a href={href} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-4 hover:border-brand-300 hover:bg-brand-50">
      <span className="text-lg font-black text-slate-800">{label}</span>
      <span className={`text-3xl font-black ${urgent && value > 0 ? "text-red-700" : "text-brand-800"}`}>{value}</span>
    </a>
  );
}

function RoleIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-base font-black text-brand-700">皇享企業電子簽呈</p>
      <h1 className="mt-1 text-3xl font-black leading-tight text-slate-950 md:text-4xl">{title}</h1>
      <p className="mt-2 text-lg font-semibold leading-8 text-slate-700">{subtitle}</p>
    </section>
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
    myApproved,
    unreadNotifications,
    pendingForMe,
    reviewing,
    rejectedOrRevision,
    gmTasksWaiting,
    gmTasksProgress,
    recentApprovals
  ] = await Promise.all([
    prisma.approvalRequest.count({ where: { applicantId: user.id, status: "NEEDS_REVISION" } }),
    prisma.approvalRequest.count({ where: { applicantId: user.id, status: "APPROVED" } }),
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
      take: 4
    })
  ]);

  const title = isGm ? "總經理工作台" : isAdmin ? "系統管理工作台" : isManager ? "主管工作台" : "我的簽呈工作台";
  const subtitle = isGm
    ? "先看待簽核，再看交辦回報。畫面只保留決策需要的內容。"
    : isManager
      ? "先處理待審核簽呈，再看部門進度與通知。"
      : "需要申請事情時填簽呈；送出後到簽呈進度查看結果。";

  return (
    <>
      <RoleIntro title={title} subtitle={subtitle} />

      <section className="mb-5 grid gap-3 lg:grid-cols-4">
        {isGm ? (
          <>
            <MainAction href="/approvals/progress?view=pending" label="待我簽核" helper="核准、駁回或退回修改" count={pendingForMe} icon={FileCheck2} tone="primary" />
            <MainAction href="/approvals/progress" label="全部簽呈進度" helper="查看全公司簽呈狀態" count={reviewing} icon={CheckCircle2} />
            <MainAction href="/gm/tasks" label="任務發派" helper="交辦事項給部門或主管" icon={ClipboardList} />
            <MainAction href="/gm/tasks?view=progress" label="交辦進度" helper="查看誰已回報、誰卡住" count={gmTasksWaiting + gmTasksProgress} icon={CheckCircle2} tone="notice" />
          </>
        ) : isManager || isAdmin ? (
          <>
            <MainAction href="/approvals/progress?view=pending" label="待我審核" helper="處理主管待審簽呈" count={pendingForMe} icon={FileCheck2} tone="primary" />
            <MainAction href="/approvals/progress" label="簽呈進度" helper="看部門案件目前在哪一關" count={reviewing} icon={CheckCircle2} />
            <MainAction href="/notifications" label="通知" helper="查看退回、核准與交辦提醒" count={unreadNotifications} icon={Bell} tone="notice" />
          </>
        ) : (
          <>
            <MainAction href="/approvals/new" label="填寫簽呈" helper="照紙本欄位填寫，送主管簽核" icon={PencilLine} tone="primary" />
            <MainAction href="/approvals/progress" label="我的簽呈進度" helper="查看審核中、已核准、被退回" icon={CheckCircle2} />
            <MainAction href="/notifications" label="通知" helper="查看主管退回或核准結果" count={unreadNotifications} icon={Bell} tone="notice" />
          </>
        )}
      </section>

      <section className="mb-5 grid gap-3 md:grid-cols-3">
        {isGm ? (
          <>
            <FocusItem label="待簽核" value={pendingForMe} href="/approvals/progress?view=pending" urgent />
            <FocusItem label="審核中" value={reviewing} href="/approvals/progress?filter=reviewing" />
            <FocusItem label="退回 / 駁回" value={rejectedOrRevision} href="/approvals/progress?filter=revision" urgent />
          </>
        ) : isManager || isAdmin ? (
          <>
            <FocusItem label="待審核" value={pendingForMe} href="/approvals/progress?view=pending" urgent />
            <FocusItem label="部門審核中" value={reviewing} href="/approvals/progress?filter=reviewing" />
            <FocusItem label="退回修改" value={rejectedOrRevision} href="/approvals/progress?filter=revision" urgent />
          </>
        ) : (
          <>
            <FocusItem label="退回修改" value={myRevision} href="/approvals/progress?filter=revision" urgent />
            <FocusItem label="已核准" value={myApproved} href="/approvals/progress?filter=approved" />
            <FocusItem label="未讀通知" value={unreadNotifications} href="/notifications" urgent />
          </>
        )}
      </section>

      <Panel>
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">最近簽呈</h2>
            <p className="text-base font-semibold text-slate-600">只列最近 4 筆，點進去看完整內容。</p>
          </div>
          <LinkButton href="/approvals/progress" variant="secondary">查看全部</LinkButton>
        </div>
        <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
          {recentApprovals.map((approval) => (
            <a key={approval.id} href={`/approvals/${approval.id}`} className="block bg-white p-4 hover:bg-brand-50">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-xl font-black leading-8 text-slate-950">{safeText(approval.subject, "未命名簽呈")}</p>
                  <p className="mt-1 text-base font-semibold text-slate-600">
                    {approval.applicant.name} · {safeText(approval.department?.name)} · {formatDateTime(approval.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <StatusBadge label={approvalStageLabel(approval)} tone={statusTone(approval.status)} />
                  <StatusBadge label={approvalStatusLabels[approval.status]} tone={statusTone(approval.status)} />
                </div>
              </div>
            </a>
          ))}
          {recentApprovals.length === 0 ? <p className="bg-white p-6 text-center text-lg font-bold text-slate-600">目前沒有簽呈紀錄。</p> : null}
        </div>
      </Panel>
    </>
  );
}
