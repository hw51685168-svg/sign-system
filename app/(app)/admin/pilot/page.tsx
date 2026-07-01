import { Bell, ClipboardCheck, FileCheck2, Gauge, MessageSquareWarning, Smartphone, Volume2, Wrench } from "lucide-react";
import { redirect } from "next/navigation";
import { PilotBanner } from "@/components/pilot-banner";
import { Button, LinkButton, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { formatDateTime, roleLabels, safeText } from "@/lib/labels";
import { canAccessPilotAdmin, getSystemCommitHash, pilotAllowedRoleKeys, pilotVersionLabel } from "@/lib/pilot";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const testEntrances = [
  { label: "總經理 / 特助 / 系統管理員", href: "/admin/pilot", note: "查看測試帳號、整體狀態與回饋" },
  { label: "所有主管", href: "/pilot/checklist", note: "依角色完成自己的測試清單" },
  { label: "所有主管", href: "/pilot/guide", note: "查看登入、PWA、語音、簽呈、任務與回報教學" },
  { label: "所有主管", href: "/pilot/feedback", note: "送出主管實測回饋" },
  { label: "所有主管", href: "/pilot/bug-report", note: "回報測試 Bug 或操作卡住問題" },
  { label: "所有主管", href: "/settings/notifications", note: "開啟 PWA Push（手機推播）" }
];

function progressPercent(total: number, completed: number) {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

export default async function AdminPilotPage() {
  const user = await requireUser();
  if (!canAccessPilotAdmin(user)) {
    redirect("/dashboard");
  }

  const [accounts, feedbacks, bugs, metrics] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, role: { key: { in: pilotAllowedRoleKeys } } },
      include: {
        role: true,
        department: true,
        store: true,
        notificationPreferences: true,
        pushSubscriptions: { where: { isActive: true }, take: 1 },
        pilotChecklistItems: true,
        pilotFeedbacks: { orderBy: { createdAt: "desc" }, take: 1 },
        pilotBugReports: { orderBy: { createdAt: "desc" }, take: 1 },
        voiceMessagesSent: { select: { id: true }, take: 1 },
        voiceMessageListens: { select: { id: true }, take: 1 }
      },
      orderBy: [{ role: { key: "asc" } }, { name: "asc" }]
    }),
    prisma.pilotFeedback.findMany({
      include: { tester: true, convertedTask: true },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    prisma.pilotBugReport.findMany({
      include: { reporter: true, convertedTask: true },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    Promise.all([
      prisma.pushSubscription.count({ where: { isActive: true } }),
      prisma.voiceMessage.count(),
      prisma.approvalRequest.count(),
      prisma.task.count(),
      prisma.serviceRequest.count(),
      prisma.issueReport.count()
    ])
  ]);

  const commitHash = getSystemCommitHash();
  const [activePushCount, voiceCount, approvalCount, taskCount, serviceCount, issueCount] = metrics;
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  return (
    <>
      <PilotBanner />
      <PageHeader
        title="主管實測管理中心"
        description={`目前版本：${pilotVersionLabel}。給總經理、總經理特助、各部門主管與各館別主管使用的第一輪實測管理頁。`}
        actions={<LinkButton href="/admin/pilot/status">查看測試狀態看板</LinkButton>}
      />

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <Panel className="border-amber-200 bg-amber-50">
          <h2 className="text-xl font-black text-amber-950">測試帳號安全提醒</h2>
          <p className="mt-2 text-base font-semibold leading-7 text-amber-950">
            主管測試期間請勿將測試帳密轉傳給非測試人員。正式上線前需改為個別帳號密碼或首次登入改密碼。
          </p>
          <p className="mt-2 text-sm font-semibold text-amber-900">
            目前尚未完成「首次登入強制改密碼」，此項已列為正式上線前必做事項。
          </p>
        </Panel>
        <Panel className="border-sky-200 bg-sky-50">
          <h2 className="text-xl font-black text-sky-950">測試資料清理提醒</h2>
          <p className="mt-2 text-base font-semibold leading-7 text-sky-950">
            測試結束後可將 QA 測試資料標記為 archived，不建議直接刪除，避免失去稽核紀錄。
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Panel className="xl:col-span-1"><Gauge className="h-7 w-7 text-brand-700" /><p className="mt-2 text-3xl font-black">{accounts.length}</p><p className="text-sm font-semibold text-slate-600">測試帳號</p></Panel>
        <Panel className="xl:col-span-1"><Smartphone className="h-7 w-7 text-brand-700" /><p className="mt-2 text-3xl font-black">{activePushCount}</p><p className="text-sm font-semibold text-slate-600">PWA 推播裝置</p></Panel>
        <Panel className="xl:col-span-1"><Volume2 className="h-7 w-7 text-brand-700" /><p className="mt-2 text-3xl font-black">{voiceCount}</p><p className="text-sm font-semibold text-slate-600">語音留言</p></Panel>
        <Panel className="xl:col-span-1"><FileCheck2 className="h-7 w-7 text-brand-700" /><p className="mt-2 text-3xl font-black">{approvalCount}</p><p className="text-sm font-semibold text-slate-600">電子簽呈</p></Panel>
        <Panel className="xl:col-span-1"><ClipboardCheck className="h-7 w-7 text-brand-700" /><p className="mt-2 text-3xl font-black">{taskCount}</p><p className="text-sm font-semibold text-slate-600">任務</p></Panel>
        <Panel className="xl:col-span-1"><Wrench className="h-7 w-7 text-brand-700" /><p className="mt-2 text-3xl font-black">{serviceCount + issueCount}</p><p className="text-sm font-semibold text-slate-600">需求 / 問題</p></Panel>
      </div>

      <Panel className="mt-5">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">主管測試帳號卡片</h2>
            <p className="text-base text-slate-700">密碼請使用目前共用測試密碼。測試網址會指向固定網址。</p>
          </div>
          <p className="rounded-md bg-slate-100 px-3 py-2 font-mono text-sm text-slate-700">commit: {commitHash}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => {
            const total = account.pilotChecklistItems.length;
            const completed = account.pilotChecklistItems.filter((item) => item.isCompleted).length;
            const percent = progressPercent(total, completed);
            const pwaReady = account.pushSubscriptions.length > 0 || account.notificationPreferences?.enablePush;
            const voiceReady = account.voiceMessagesSent.length > 0 || account.voiceMessageListens.length > 0;
            return (
              <article key={account.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-slate-950">{roleLabels[account.role.key]}</p>
                    <p className="mt-1 text-base font-semibold text-slate-800">{account.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{account.email}</p>
                  </div>
                  <StatusBadge label={`${percent}%`} tone={percent >= 80 ? "green" : percent > 0 ? "amber" : "slate"} />
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                  <p>部門／館別：{safeText(account.store?.name ?? account.department?.name, "未指定")}</p>
                  <p>測試網址：{baseUrl}</p>
                  <p>是否已登入：{account.lastLoginAt ? `是，${formatDateTime(account.lastLoginAt)}` : "尚未登入"}</p>
                  <p>PWA Push：{pwaReady ? "已開啟或已訂閱" : "尚未完成"}</p>
                  <p>語音測試：{voiceReady ? "已有語音紀錄" : "尚未完成"}</p>
                  <p>已送出回饋：{account.pilotFeedbacks.length > 0 ? "是" : "否"}</p>
                  <p>Bug 回報：{account.pilotBugReports.length > 0 ? "有" : "無"}</p>
                </div>
              </article>
            );
          })}
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <h2 className="mb-4 text-2xl font-black text-slate-950">每個角色的測試入口</h2>
          <div className="grid gap-3">
            {testEntrances.map((item) => (
              <a key={`${item.label}-${item.href}`} href={item.href} className="rounded-lg border border-slate-200 p-4 hover:border-brand-300 hover:bg-brand-50">
                <p className="font-black text-slate-950">{item.label}</p>
                <p className="mt-1 text-sm text-slate-600">{item.note}</p>
                <p className="mt-2 text-sm font-semibold text-brand-700">{item.href}</p>
              </a>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-black text-slate-950">
            <MessageSquareWarning className="h-6 w-6 text-brand-700" />
            最近主管回饋與 Bug
          </h2>
          <div className="grid gap-4">
            {feedbacks.map((feedback) => (
              <div key={feedback.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-slate-950">回饋：{feedback.tester.name}</p>
                  <StatusBadge label={feedback.priority} tone={feedback.priority === "P0" ? "red" : feedback.priority === "P1" ? "amber" : "slate"} />
                </div>
                <p className="mt-2 text-sm text-slate-700">{feedback.suggestions ?? feedback.stuckPoint ?? "未填寫建議"}</p>
                {feedback.convertedTaskId ? (
                  <a className="mt-2 inline-block text-sm font-bold text-brand-700" href={`/tasks/${feedback.convertedTaskId}`}>查看改善任務</a>
                ) : (
                  <form className="mt-3" action={`/api/pilot/feedback/${feedback.id}/convert-to-task`} method="post">
                    <Button type="submit" variant="secondary">轉成改善任務</Button>
                  </form>
                )}
              </div>
            ))}
            {bugs.map((bug) => (
              <div key={bug.id} className="rounded-lg border border-red-100 bg-red-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-slate-950">Bug：{bug.title}</p>
                  <StatusBadge label={bug.severity} tone={bug.severity === "P0" ? "red" : bug.severity === "P1" ? "amber" : "slate"} />
                </div>
                <p className="mt-2 text-sm text-slate-700">{bug.description}</p>
                {bug.convertedTaskId ? (
                  <a className="mt-2 inline-block text-sm font-bold text-brand-700" href={`/tasks/${bug.convertedTaskId}`}>查看修正任務</a>
                ) : (
                  <form className="mt-3" action={`/api/pilot/bug-report/${bug.id}/convert-to-task`} method="post">
                    <Button type="submit" variant="secondary">轉成修正任務</Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
