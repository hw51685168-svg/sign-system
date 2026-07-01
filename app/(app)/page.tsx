import { AlertTriangle, Bell, ClipboardList, FileCheck2, PlusCircle, Store, Wrench } from "lucide-react";
import { ApprovalLiteDashboard } from "@/components/approval-lite-dashboard";
import { PilotBanner } from "@/components/pilot-banner";
import { EmptyState, LinkButton, Panel, StatusBadge, statusTone } from "@/components/ui";
import { isApprovalLiteMode } from "@/lib/app-mode";
import { approvalStatusLabels, formatDate, roleLabels, safeText, taskStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { announcementVisibleWhere, canAssignTasks, canCreateOperationalReports, scopedApprovalWhere, scopedTaskWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

type StatusCard = {
  title: string;
  value: number;
  href: string;
  description: string;
  tone: string;
  icon: typeof ClipboardList;
};

function StatusCardLink({ card }: { card: StatusCard }) {
  const Icon = card.icon;
  return (
    <a href={card.href} className={`rounded-lg border p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg ${card.tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold">{card.title}</p>
          <p className="mt-2 text-5xl font-black leading-none">{card.value}</p>
          <p className="mt-3 text-base font-semibold opacity-80">{card.description}</p>
        </div>
        <Icon className="h-8 w-8 shrink-0 opacity-80" />
      </div>
    </a>
  );
}

function roleProfile(roleKey: string) {
  const profiles: Record<string, { title: string; subtitle: string; focus: string[]; primaryHref: string; primaryLabel: string }> = {
    GENERAL_MANAGER: {
      title: "總經理決策工作台",
      subtitle: "集中查看全公司簽呈、逾期任務、跨部門卡關與緊急通知。",
      focus: ["全公司待核准簽呈", "逾期任務", "各部門處理效率", "各館別異常", "P0 緊急通知"],
      primaryHref: "/approvals?status=pending",
      primaryLabel: "查看待核准簽呈"
    },
    EXECUTIVE_ASSISTANT: {
      title: "總經理特助追蹤中心",
      subtitle: "協助追蹤跨部門卡關事項、主管未回覆事項與重要服務需求。",
      focus: ["跨部門卡關", "主管未回覆", "催辦通知", "服務需求流程"],
      primaryHref: "/services",
      primaryLabel: "查看服務需求"
    },
    ACCOUNTING_MANAGER: {
      title: "會計主管工作台",
      subtitle: "聚焦請款、缺件、補附件與財務敏感資料權限。",
      focus: ["待審請款", "缺件單據", "退回補件", "敏感資料 Audit Log"],
      primaryHref: "/approvals?type=PURCHASE",
      primaryLabel: "查看請款簽呈"
    },
    DESIGN_MANAGER: {
      title: "美工主管需求中心",
      subtitle: "集中管理設計需求、缺素材案件、語音修改說明與服務需求。",
      focus: ["設計需求", "缺素材案件", "修改需求", "服務需求完成"],
      primaryHref: "/services",
      primaryLabel: "查看設計需求"
    },
    SOCIAL_MEDIA_MANAGER: {
      title: "自媒體主管工作台",
      subtitle: "追蹤拍攝、剪輯、發布、門市素材與企劃補充。",
      focus: ["本週拍攝", "待剪輯", "待發布", "素材需求"],
      primaryHref: "/tasks",
      primaryLabel: "查看拍攝任務"
    },
    HR_MANAGER: {
      title: "人事主管工作台",
      subtitle: "追蹤新人訓練、試用期提醒、課程完成率與人事資料權限。",
      focus: ["新人訓練", "試用期提醒", "課程完成率", "人事權限"],
      primaryHref: "/tasks",
      primaryLabel: "查看人事任務"
    },
    CONSTRUCTION_MANAGER: {
      title: "建設主管工程中心",
      subtitle: "追蹤工程進度、現場照片、缺失改善、服務需求與請款簽呈。",
      focus: ["工程進度", "現場照片", "缺失改善", "請款簽呈"],
      primaryHref: "/services",
      primaryLabel: "查看工程需求"
    },
    BRANCH_MANAGER: {
      title: "館別主管營運工作台",
      subtitle: "查看自己館別任務、客訴異常、通知、補貨與問題回報。",
      focus: ["今日館別任務", "客訴或異常", "現場問題", "館別通知"],
      primaryHref: "/issues",
      primaryLabel: "查看問題回報"
    },
    ADMIN_MANAGER: {
      title: "行政主管工作台",
      subtitle: "處理庶務、設備、行政任務、服務需求與跨部門協作。",
      focus: ["行政待辦", "設備庶務", "服務需求", "催辦通知"],
      primaryHref: "/services",
      primaryLabel: "查看行政需求"
    }
  };

  return profiles[roleKey] ?? {
    title: "我的工作台",
    subtitle: "查看和自己相關的任務、簽呈、通知與待辦事項。",
    focus: ["我的待辦", "我的任務", "我的簽呈", "通知中心"],
    primaryHref: "/tasks",
    primaryLabel: "查看任務"
  };
}

export default async function DashboardPage() {
  const user = await requireUser();
  if (isApprovalLiteMode()) {
    return <ApprovalLiteDashboard user={user} />;
  }

  const taskWhere = scopedTaskWhere(user);
  const approvalWhere = scopedApprovalWhere(user);
  const profile = roleProfile(user.roleKey);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    todayTasks,
    inProgressTasks,
    rejectedTasks,
    overdueTasks,
    pendingApprovals,
    priorityTasks,
    priorityApprovals,
    unreadAnnouncements,
    unreadNotifications
  ] = await Promise.all([
    prisma.task.count({
      where: { AND: [taskWhere, { dueDate: { gte: todayStart, lte: todayEnd }, status: { notIn: ["COMPLETED", "CANCELLED"] } }] }
    }),
    prisma.task.count({ where: { AND: [taskWhere, { status: "IN_PROGRESS" }] } }),
    prisma.task.count({ where: { AND: [taskWhere, { status: "REJECTED" }] } }),
    prisma.task.count({
      where: {
        AND: [
          taskWhere,
          { OR: [{ status: "OVERDUE" }, { dueDate: { lt: todayStart }, status: { notIn: ["COMPLETED", "CANCELLED"] } }] }
        ]
      }
    }),
    prisma.approvalRequest.count({
      where: { AND: [approvalWhere, { status: { in: ["SUBMITTED", "REVIEWING", "NEEDS_REVISION"] } }] }
    }),
    prisma.task.findMany({
      where: { AND: [taskWhere, { status: { notIn: ["COMPLETED", "CANCELLED"] } }] },
      include: { owner: true, department: true },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 5
    }),
    prisma.approvalRequest.findMany({
      where: { AND: [approvalWhere, { status: { in: ["SUBMITTED", "REVIEWING", "NEEDS_REVISION"] } }] },
      include: { applicant: true, department: true },
      orderBy: { updatedAt: "desc" },
      take: 5
    }),
    prisma.announcement.count({
      where: { AND: [announcementVisibleWhere(user), { requireConfirmation: true }, { reads: { none: { userId: user.id } } }] }
    }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } })
  ]);

  const cards: StatusCard[] = [
    {
      title: "今日待辦",
      value: todayTasks,
      href: "/tasks?status=today",
      description: "今天需要完成或追蹤",
      tone: "border-sky-200 bg-sky-50 text-sky-900",
      icon: ClipboardList
    },
    {
      title: "進行中",
      value: inProgressTasks,
      href: "/tasks?status=in_progress",
      description: "正在處理的任務",
      tone: "border-orange-200 bg-orange-50 text-orange-900",
      icon: ClipboardList
    },
    {
      title: "待審簽呈",
      value: pendingApprovals,
      href: "/approvals?status=pending",
      description: "需要查看或簽核",
      tone: "border-purple-200 bg-purple-50 text-purple-900",
      icon: FileCheck2
    },
    {
      title: "退回修改",
      value: rejectedTasks,
      href: "/tasks?status=rejected",
      description: "需要補充或重做",
      tone: "border-red-200 bg-red-50 text-red-900",
      icon: AlertTriangle
    },
    {
      title: "已逾期",
      value: overdueTasks,
      href: "/tasks?status=overdue",
      description: "主管需優先追蹤",
      tone: "border-rose-300 bg-rose-50 text-rose-950",
      icon: AlertTriangle
    }
  ];

  return (
    <>
      <PilotBanner />

      <section className="mb-6 rounded-lg border border-brand-100 bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-base font-bold text-brand-700">{roleLabels[user.roleKey] ?? user.roleName}</p>
            <h1 className="mt-2 text-4xl font-black text-slate-950">{profile.title}</h1>
            <p className="mt-2 text-lg font-semibold text-slate-700">{profile.subtitle}</p>
            <p className="mt-2 text-base text-slate-700">
              {safeText(user.name)} · {safeText(user.departmentName, "未指定部門")} {user.storeName ? `· ${user.storeName}` : ""}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <LinkButton href={profile.primaryHref}>
              <FileCheck2 className="h-5 w-5" />
              {profile.primaryLabel}
            </LinkButton>
            {canCreateOperationalReports(user) ? (
              <LinkButton href="/approvals/new" variant="secondary">
                <PlusCircle className="h-5 w-5" />
                新增簽呈
              </LinkButton>
            ) : null}
            {canAssignTasks(user) ? (
              <LinkButton href="/tasks/new" variant="secondary">
                <ClipboardList className="h-5 w-5" />
                指派任務
              </LinkButton>
            ) : null}
            {canCreateOperationalReports(user) ? (
              <LinkButton href="/issues" variant="secondary">
                <Store className="h-5 w-5" />
                問題回報
              </LinkButton>
            ) : null}
            <LinkButton href="/notifications" variant="secondary">
              <Bell className="h-5 w-5" />
              通知中心
            </LinkButton>
            <LinkButton href="/services" variant="secondary">
              <Wrench className="h-5 w-5" />
              Service Catalog（服務目錄）
            </LinkButton>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <StatusCardLink key={card.title} card={card} />
        ))}
      </section>

      <section className="mt-6 rounded-lg border border-brand-100 bg-white p-5 shadow-soft">
        <h2 className="text-2xl font-black text-slate-950">本角色測試重點</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {profile.focus.map((item) => (
            <a key={item} href="/pilot/checklist" className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-lg font-bold text-slate-900 hover:border-brand-300 hover:bg-brand-50">
              {item}
            </a>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-slate-950">優先處理清單</h2>
              <p className="text-base text-slate-700">依截止日與更新時間排序，主管測試時請優先點開查看。</p>
            </div>
            <LinkButton href="/tasks" variant="secondary">查看任務</LinkButton>
          </div>
          <div className="grid gap-3">
            {priorityTasks.length === 0 && priorityApprovals.length === 0 && unreadAnnouncements === 0 ? (
              <EmptyState title="目前沒有優先待辦" description="可以改測試簽呈、PWA 推播、語音留言或主管回饋流程。" />
            ) : null}

            {priorityTasks.map((task) => (
              <a key={task.id} href={`/tasks/${task.id}`} className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:bg-brand-50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xl font-bold text-slate-950">{safeText(task.title, "未命名任務")}</p>
                    <p className="mt-1 text-base text-slate-700">
                      負責人：{safeText(task.owner.name)} · 部門：{safeText(task.department?.name, "未指定")} · 截止：{formatDate(task.dueDate)}
                    </p>
                  </div>
                  <StatusBadge label={taskStatusLabels[task.status]} tone={statusTone(task.status)} />
                </div>
                <div className="mt-4 h-3 rounded-full bg-slate-100">
                  <div className="h-3 rounded-full bg-brand-700" style={{ width: `${Math.min(Math.max(task.progress, 0), 100)}%` }} />
                </div>
              </a>
            ))}

            {priorityApprovals.map((approval) => (
              <a key={approval.id} href={`/approvals/${approval.id}`} className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:bg-brand-50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xl font-bold text-slate-950">{safeText(approval.subject, "未命名簽呈")}</p>
                    <p className="mt-1 text-base text-slate-700">
                      申請人：{safeText(approval.applicant.name)} · 部門：{safeText(approval.department?.name, "未指定")}
                    </p>
                  </div>
                  <StatusBadge label={approvalStatusLabels[approval.status]} tone={statusTone(approval.status)} />
                </div>
              </a>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 className="text-2xl font-black text-slate-950">通知與公告</h2>
          <div className="mt-4 grid gap-3">
            <a href="/announcements" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <p className="text-lg font-bold">尚未確認公告</p>
              <p className="mt-2 text-4xl font-black">{unreadAnnouncements}</p>
            </a>
            <a href="/notifications" className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sky-950">
              <p className="text-lg font-bold">未讀通知</p>
              <p className="mt-2 text-4xl font-black">{unreadNotifications}</p>
            </a>
            <LinkButton href="/pilot/checklist" variant="secondary">開始主管測試清單</LinkButton>
          </div>
        </Panel>
      </section>
    </>
  );
}
