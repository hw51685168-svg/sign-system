import { PilotBanner } from "@/components/pilot-banner";
import { CopyButton } from "@/components/copy-button";
import { redirect } from "next/navigation";
import { LinkButton, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { codexFixStatusLabels, errorSeverityLabels, errorSeverityTone, errorStatusTone } from "@/lib/error-labels";
import { formatDateTime, roleLabels, safeText } from "@/lib/labels";
import { getPilotMonitoringData } from "@/lib/pilot-monitoring";
import { canAccessPilotAdmin } from "@/lib/pilot";
import { requireUser } from "@/lib/session";

function percent(total: number, completed: number) {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

export default async function AdminPilotStatusPage() {
  const user = await requireUser();
  if (!canAccessPilotAdmin(user)) {
    redirect("/dashboard");
  }

  const monitoring = await getPilotMonitoringData();
  const {
    accounts,
    dailySummary,
    completion,
    p0BugCount,
    p1BugCount,
    p0ErrorCount,
    p1ErrorCount,
    todayErrorCount,
    unresolvedErrorCount,
    codexFixCount,
    githubIssueCount,
    pendingCodexFixRequests
  } = monitoring;

  const summaryCards = [
    { label: "已登入主管", value: completion.loggedInCount, total: accounts.length, tone: "green" as const },
    { label: "尚未登入", value: completion.notLoggedInCount, total: accounts.length, tone: "amber" as const },
    { label: "完成測試清單", value: completion.completedChecklistCount, total: accounts.length, tone: "green" as const },
    { label: "已開啟 PWA Push", value: completion.pushReadyCount, total: accounts.length, tone: "blue" as const },
    { label: "已測試語音", value: completion.voiceReadyCount, total: accounts.length, tone: "purple" as const },
    { label: "已送出回饋", value: completion.feedbackCount, total: accounts.length, tone: "green" as const },
    { label: "有回報 Bug", value: completion.bugReporterCount, total: accounts.length, tone: "red" as const },
    { label: "P0 / P1 Bug", value: p0BugCount + p1BugCount, total: p0BugCount + p1BugCount, tone: "red" as const },
    { label: "P0 / P1 系統錯誤", value: p0ErrorCount + p1ErrorCount, total: p0ErrorCount + p1ErrorCount, tone: "red" as const },
    { label: "今日系統錯誤", value: todayErrorCount, total: todayErrorCount, tone: "amber" as const },
    { label: "未解決系統錯誤", value: unresolvedErrorCount, total: unresolvedErrorCount, tone: "red" as const },
    { label: "Codex / GitHub", value: codexFixCount + githubIssueCount, total: codexFixCount + githubIssueCount, tone: "blue" as const }
  ];

  const dailyCards = [
    { label: "今日登入主管數", value: dailySummary.todayLoggedInSupervisorCount, tone: "green" as const },
    { label: "今日尚未登入主管數", value: dailySummary.notLoggedInTodaySupervisorCount, tone: "amber" as const },
    { label: "今日完成測試清單數", value: dailySummary.todayCompletedChecklistCount, tone: "green" as const },
    { label: "今日送出回饋數", value: dailySummary.todayFeedbackCount, tone: "blue" as const },
    { label: "今日 Bug 回報數", value: dailySummary.todayBugCount, tone: "red" as const },
    { label: "今日 P0 錯誤數", value: dailySummary.todayP0ErrorCount, tone: "red" as const },
    { label: "今日 P1 錯誤數", value: dailySummary.todayP1ErrorCount, tone: "amber" as const },
    { label: "今日 Codex 修復單數", value: dailySummary.todayCodexFixCount, tone: "blue" as const },
    { label: "今日 PWA Push 開啟人數", value: dailySummary.todayPushEnabledUserCount, tone: "purple" as const },
    { label: "今日語音測試完成數", value: dailySummary.todayVoiceTestCompletedUserCount, tone: "purple" as const }
  ];

  return (
    <>
      <PilotBanner compact />
      <PageHeader
        title="主管測試狀態看板"
        description="集中查看主管第一輪實測進度、PWA Push（手機推播）、語音測試、回饋、Bug 與系統錯誤。"
        actions={
          <>
            <LinkButton href="/admin/pilot" variant="secondary">返回實測管理中心</LinkButton>
            <LinkButton href="/api/admin/pilot/daily-report" variant="secondary">匯出主管測試日報</LinkButton>
            <LinkButton href="/admin/errors">Error Command Center（錯誤中心）</LinkButton>
          </>
        }
      />

      <Panel className="mb-5">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">今日測試摘要</h2>
            <p className="text-base text-slate-700">統計區間：{formatDateTime(dailySummary.todayStart)} 起算。</p>
          </div>
          <a className="font-bold text-brand-700 hover:underline" href="/api/admin/pilot/daily-report">下載 JSON 日報</a>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {dailyCards.map((card) => (
            <div key={card.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">{card.label}</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-3xl font-black text-slate-950">{card.value}</p>
                <StatusBadge label={card.value > 0 ? "有紀錄" : "無"} tone={card.value > 0 ? card.tone : "slate"} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Panel key={card.label}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-500">{card.label}</p>
                <p className="mt-2 text-4xl font-black text-slate-950">{card.value}</p>
              </div>
              <StatusBadge label={card.total > 0 ? `${percent(card.total, card.value)}%` : "0%"} tone={card.tone} />
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="mt-5">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">待處理 Codex 修復單</h2>
            <p className="text-base text-slate-700">P0 / P1 錯誤會自動產生修復單。可從這裡複製 prompt 給 Codex 或進入詳情頁處理。</p>
          </div>
          <StatusBadge label={`${pendingCodexFixRequests.length} 筆待處理`} tone={pendingCodexFixRequests.length > 0 ? "amber" : "green"} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-base">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-800">
              <tr>
                <th className="px-3 py-3">修復單標題</th>
                <th className="px-3 py-3">嚴重程度</th>
                <th className="px-3 py-3">來源錯誤</th>
                <th className="px-3 py-3">建立時間</th>
                <th className="px-3 py-3">狀態</th>
                <th className="px-3 py-3">CODEX_INBOX</th>
                <th className="px-3 py-3">GitHub Issue</th>
                <th className="px-3 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingCodexFixRequests.map((request) => (
                <tr key={request.id} className="align-top hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <a className="font-black text-brand-800 hover:underline" href={`/admin/codex-fix-requests/${request.id}`}>{request.title}</a>
                  </td>
                  <td className="px-3 py-3"><StatusBadge label={errorSeverityLabels[request.severity]} tone={errorSeverityTone(request.severity)} /></td>
                  <td className="px-3 py-3">
                    <a className="font-bold text-brand-700 hover:underline" href={`/admin/errors/${request.errorReportId}`}>{request.errorReport.title}</a>
                  </td>
                  <td className="px-3 py-3">{formatDateTime(request.createdAt)}</td>
                  <td className="px-3 py-3"><StatusBadge label={codexFixStatusLabels[request.status]} tone={errorStatusTone(request.status)} /></td>
                  <td className="px-3 py-3">{request.sentToCodexAt ? "已寫入" : "尚未寫入"}</td>
                  <td className="px-3 py-3">{request.githubIssueUrl ? <a className="font-bold text-brand-700 hover:underline" href={request.githubIssueUrl}>已建立</a> : "尚未建立"}</td>
                  <td className="px-3 py-3"><CopyButton text={request.codexPrompt} /></td>
                </tr>
              ))}
              {pendingCodexFixRequests.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-600" colSpan={8}>目前沒有待處理 Codex 修復單。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="mt-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-black text-slate-950">主管逐人狀態</h2>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={`P0 Bug：${p0BugCount}`} tone={p0BugCount > 0 ? "red" : "green"} />
            <StatusBadge label={`P1 Bug：${p1BugCount}`} tone={p1BugCount > 0 ? "amber" : "green"} />
            <StatusBadge label={`P0 錯誤：${p0ErrorCount}`} tone={p0ErrorCount > 0 ? "red" : "green"} />
            <StatusBadge label={`P1 錯誤：${p1ErrorCount}`} tone={p1ErrorCount > 0 ? "amber" : "green"} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-base">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-800">
              <tr>
                <th className="px-3 py-3">測試人</th>
                <th className="px-3 py-3">角色</th>
                <th className="px-3 py-3">部門／館別</th>
                <th className="px-3 py-3">最後登入</th>
                <th className="px-3 py-3">清單</th>
                <th className="px-3 py-3">PWA Push</th>
                <th className="px-3 py-3">語音</th>
                <th className="px-3 py-3">回饋</th>
                <th className="px-3 py-3">Bug</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((account) => {
                const total = account.pilotChecklistItems.length;
                const completed = account.pilotChecklistItems.filter((item) => item.isCompleted).length;
                const pwaReady = account.pushSubscriptions.length > 0 || account.notificationPreferences?.enablePush;
                const voiceReady = account.voiceMessagesSent.length > 0 || account.voiceMessageListens.length > 0;
                return (
                  <tr key={account.id} className="align-top hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <p className="font-black text-slate-950">{account.name}</p>
                      <p className="text-sm text-slate-600">{account.email}</p>
                    </td>
                    <td className="px-3 py-3">{roleLabels[account.role.key]}</td>
                    <td className="px-3 py-3">{safeText(account.store?.name ?? account.department?.name, "未指定")}</td>
                    <td className="px-3 py-3">{account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "尚未登入"}</td>
                    <td className="px-3 py-3">{completed}/{total}（{percent(total, completed)}%）</td>
                    <td className="px-3 py-3"><StatusBadge label={pwaReady ? "已完成" : "未完成"} tone={pwaReady ? "green" : "slate"} /></td>
                    <td className="px-3 py-3"><StatusBadge label={voiceReady ? "已完成" : "未完成"} tone={voiceReady ? "green" : "slate"} /></td>
                    <td className="px-3 py-3">{account.pilotFeedbacks.length > 0 ? "已送出" : "尚未送出"}</td>
                    <td className="px-3 py-3">{account.pilotBugReports.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
