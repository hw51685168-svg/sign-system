import { AlertTriangle, Bot, Bug, Github, ShieldAlert } from "lucide-react";
import { ErrorReportStatus, ErrorSeverity } from "@prisma/client";
import { redirect } from "next/navigation";
import { PilotBanner } from "@/components/pilot-banner";
import { LinkButton, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { errorSeverityLabels, errorSeverityTone, errorStatusLabels, errorStatusTone } from "@/lib/error-labels";
import { formatDateTime, safeText } from "@/lib/labels";
import { canAccessErrorCommandCenter } from "@/lib/error-command-center";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

function optionValues<T extends string>(values: Record<string, T> | T[]) {
  return Array.isArray(values) ? values : Object.values(values);
}

export default async function AdminErrorsPage({
  searchParams
}: {
  searchParams?: { severity?: ErrorSeverity; status?: ErrorReportStatus; q?: string };
}) {
  const user = await requireUser();
  if (!canAccessErrorCommandCenter(user)) {
    redirect("/dashboard");
  }

  const severity = searchParams?.severity && optionValues(ErrorSeverity).includes(searchParams.severity) ? searchParams.severity : undefined;
  const status = searchParams?.status && optionValues(ErrorReportStatus).includes(searchParams.status) ? searchParams.status : undefined;
  const q = searchParams?.q?.trim();
  const where = {
    ...(severity ? { severity } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { message: { contains: q, mode: "insensitive" as const } },
            { route: { contains: q, mode: "insensitive" as const } },
            { module: { contains: q, mode: "insensitive" as const } }
          ]
        }
      : {})
  };
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [errors, p0Count, p1Count, todayCount, unresolvedCount, codexCount, githubCount] = await Promise.all([
    prisma.errorReport.findMany({
      where,
      include: { user: true, codexFixRequests: true },
      orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }],
      take: 80
    }),
    prisma.errorReport.count({ where: { severity: "P0", status: { notIn: ["CLOSED", "IGNORED", "VERIFIED"] } } }),
    prisma.errorReport.count({ where: { severity: "P1", status: { notIn: ["CLOSED", "IGNORED", "VERIFIED"] } } }),
    prisma.errorReport.count({ where: { lastSeenAt: { gte: todayStart } } }),
    prisma.errorReport.count({ where: { isResolved: false } }),
    prisma.codexFixRequest.count(),
    prisma.errorReport.count({ where: { githubIssueUrl: { not: null } } })
  ]);

  return (
    <>
      <PilotBanner compact />
      <PageHeader
        title="Error Command Center（錯誤指揮中心）"
        description="自動收集主管測試期間的前端、API、PWA、語音、簽呈與任務錯誤，並產生 Codex 修復單。"
        actions={<LinkButton href="/admin/pilot/status" variant="secondary">查看主管測試狀態</LinkButton>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Panel><ShieldAlert className="h-7 w-7 text-red-700" /><p className="mt-2 text-4xl font-black">{p0Count}</p><p className="text-sm font-bold text-slate-600">P0 阻擋測試</p></Panel>
        <Panel><AlertTriangle className="h-7 w-7 text-amber-600" /><p className="mt-2 text-4xl font-black">{p1Count}</p><p className="text-sm font-bold text-slate-600">P1 嚴重</p></Panel>
        <Panel><Bug className="h-7 w-7 text-brand-700" /><p className="mt-2 text-4xl font-black">{todayCount}</p><p className="text-sm font-bold text-slate-600">今日錯誤</p></Panel>
        <Panel><Bug className="h-7 w-7 text-brand-700" /><p className="mt-2 text-4xl font-black">{unresolvedCount}</p><p className="text-sm font-bold text-slate-600">未解決</p></Panel>
        <Panel><Bot className="h-7 w-7 text-brand-700" /><p className="mt-2 text-4xl font-black">{codexCount}</p><p className="text-sm font-bold text-slate-600">Codex 修復單</p></Panel>
        <Panel><Github className="h-7 w-7 text-brand-700" /><p className="mt-2 text-4xl font-black">{githubCount}</p><p className="text-sm font-bold text-slate-600">GitHub Issue</p></Panel>
      </div>

      <Panel className="mt-5">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_200px_auto]" action="/admin/errors" method="get">
          <input name="q" defaultValue={q ?? ""} placeholder="搜尋標題、訊息、route（頁面路徑）、module（模組）" />
          <select name="severity" defaultValue={severity ?? ""}>
            <option value="">全部等級</option>
            {optionValues(ErrorSeverity).map((item) => (
              <option key={item} value={item}>{errorSeverityLabels[item]}</option>
            ))}
          </select>
          <select name="status" defaultValue={status ?? ""}>
            <option value="">全部狀態</option>
            {optionValues(ErrorReportStatus).map((item) => (
              <option key={item} value={item}>{errorStatusLabels[item]}</option>
            ))}
          </select>
          <button className="min-h-12 rounded-md bg-brand-700 px-4 font-bold text-white" type="submit">套用篩選</button>
        </form>
      </Panel>

      <Panel className="mt-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-base">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-800">
              <tr>
                <th className="px-3 py-3">錯誤</th>
                <th className="px-3 py-3">等級</th>
                <th className="px-3 py-3">狀態</th>
                <th className="px-3 py-3">route（頁面）</th>
                <th className="px-3 py-3">module（模組）</th>
                <th className="px-3 py-3">使用者</th>
                <th className="px-3 py-3">次數</th>
                <th className="px-3 py-3">Codex</th>
                <th className="px-3 py-3">最後發生</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {errors.map((error) => (
                <tr key={error.id} className="align-top hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <a className="font-black text-brand-800 hover:underline" href={`/admin/errors/${error.id}`}>{error.title}</a>
                    <p className="mt-1 max-w-md truncate text-sm text-slate-600">{error.message}</p>
                  </td>
                  <td className="px-3 py-3"><StatusBadge label={errorSeverityLabels[error.severity]} tone={errorSeverityTone(error.severity)} /></td>
                  <td className="px-3 py-3"><StatusBadge label={errorStatusLabels[error.status]} tone={errorStatusTone(error.status)} /></td>
                  <td className="px-3 py-3">{safeText(error.route, "未提供")}</td>
                  <td className="px-3 py-3">{safeText(error.module, "未提供")}</td>
                  <td className="px-3 py-3">{safeText(error.user?.name ?? error.userRole, "未登入或未知")}</td>
                  <td className="px-3 py-3">{error.occurrenceCount}</td>
                  <td className="px-3 py-3">
                    {error.codexFixRequests[0] ? (
                      <a className="font-bold text-brand-700 hover:underline" href={`/admin/codex-fix-requests/${error.codexFixRequests[0].id}`}>查看修復單</a>
                    ) : (
                      "尚未建立"
                    )}
                  </td>
                  <td className="px-3 py-3">{formatDateTime(error.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
