import { AlertTriangle, Bot, Bug, CheckCircle2, Github, ShieldAlert } from "lucide-react";
import { ErrorReportStatus, ErrorSeverity } from "@prisma/client";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { PilotBanner } from "@/components/pilot-banner";
import { LinkButton, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { codexFixStatusLabels, errorSeverityLabels, errorSeverityTone, errorStatusLabels, errorStatusTone } from "@/lib/error-labels";
import { pendingCodexFixStatuses, unresolvedErrorStatuses } from "@/lib/error-status";
import { formatDateTime, safeText } from "@/lib/labels";
import { canAccessErrorCommandCenter } from "@/lib/error-command-center";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

function optionValues<T extends string>(values: Record<string, T> | T[]) {
  return Array.isArray(values) ? values : Object.values(values);
}

function StatCard({
  icon,
  value,
  label
}: {
  icon: ReactNode;
  value: number;
  label: string;
}) {
  return (
    <Panel>
      {icon}
      <p className="mt-2 text-4xl font-black">{value}</p>
      <p className="text-sm font-bold text-slate-600">{label}</p>
    </Panel>
  );
}

export default async function AdminErrorsPage({
  searchParams
}: {
  searchParams?: Promise<{ severity?: ErrorSeverity; status?: ErrorReportStatus; q?: string }>;
}) {
  const parsedSearchParams = (await searchParams) ?? {};
  const user = await requireUser();
  if (!canAccessErrorCommandCenter(user)) {
    redirect("/dashboard");
  }

  const severity =
    parsedSearchParams.severity && optionValues(ErrorSeverity).includes(parsedSearchParams.severity) ? parsedSearchParams.severity : undefined;
  const status =
    parsedSearchParams.status && optionValues(ErrorReportStatus).includes(parsedSearchParams.status) ? parsedSearchParams.status : undefined;
  const q = parsedSearchParams.q?.trim();
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

  const [
    errors,
    p0Count,
    p1Count,
    todayCount,
    unresolvedCount,
    pendingCodexCount,
    closedCodexCount,
    githubCount
  ] = await Promise.all([
    prisma.errorReport.findMany({
      where,
      include: { user: true, codexFixRequests: true },
      orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }],
      take: 80
    }),
    prisma.errorReport.count({ where: { severity: "P0", status: { in: unresolvedErrorStatuses } } }),
    prisma.errorReport.count({ where: { severity: "P1", status: { in: unresolvedErrorStatuses } } }),
    prisma.errorReport.count({ where: { lastSeenAt: { gte: todayStart }, status: { not: "IGNORED" } } }),
    prisma.errorReport.count({ where: { status: { in: unresolvedErrorStatuses }, isResolved: false } }),
    prisma.codexFixRequest.count({ where: { status: { in: pendingCodexFixStatuses } } }),
    prisma.codexFixRequest.count({ where: { status: { in: ["FIXED", "VERIFIED", "CLOSED"] } } }),
    prisma.errorReport.count({ where: { githubIssueUrl: { not: null } } })
  ]);

  return (
    <>
      <PilotBanner compact />
      <PageHeader
        title="Error Command Center（錯誤指揮中心）"
        description="自動收集前端、API、PWA、語音、簽呈與任務錯誤，並產生 Codex 修復單。狀態會同步顯示錯誤與修復單目前處理進度。"
        actions={<LinkButton href="/admin/pilot/status" variant="secondary">查看主管測試狀態</LinkButton>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
        <StatCard icon={<ShieldAlert className="h-7 w-7 text-red-700" />} value={p0Count} label="P0 未解決" />
        <StatCard icon={<AlertTriangle className="h-7 w-7 text-amber-600" />} value={p1Count} label="P1 未解決" />
        <StatCard icon={<Bug className="h-7 w-7 text-brand-700" />} value={todayCount} label="今日錯誤" />
        <StatCard icon={<Bug className="h-7 w-7 text-brand-700" />} value={unresolvedCount} label="未解決錯誤" />
        <StatCard icon={<Bot className="h-7 w-7 text-brand-700" />} value={pendingCodexCount} label="待處理修復單" />
        <StatCard icon={<CheckCircle2 className="h-7 w-7 text-emerald-700" />} value={closedCodexCount} label="已完成修復單" />
        <StatCard icon={<Github className="h-7 w-7 text-brand-700" />} value={githubCount} label="GitHub Issue" />
        <StatCard icon={<Bot className="h-7 w-7 text-slate-700" />} value={pendingCodexCount + closedCodexCount} label="修復單總數" />
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
          <table className="w-full min-w-[1280px] text-left text-base">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-800">
              <tr>
                <th className="px-3 py-3">錯誤</th>
                <th className="px-3 py-3">等級</th>
                <th className="px-3 py-3">錯誤狀態</th>
                <th className="px-3 py-3">修復單狀態</th>
                <th className="px-3 py-3">route（頁面）</th>
                <th className="px-3 py-3">module（模組）</th>
                <th className="px-3 py-3">使用者</th>
                <th className="px-3 py-3">次數</th>
                <th className="px-3 py-3">最後發生</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {errors.map((error) => {
                const fixRequest = error.codexFixRequests[0];
                return (
                  <tr key={error.id} className="align-top hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <a className="font-black text-brand-800 hover:underline" href={`/admin/errors/${error.id}`}>{error.title}</a>
                      <p className="mt-1 max-w-md truncate text-sm text-slate-600">{error.message}</p>
                    </td>
                    <td className="px-3 py-3"><StatusBadge label={errorSeverityLabels[error.severity]} tone={errorSeverityTone(error.severity)} /></td>
                    <td className="px-3 py-3"><StatusBadge label={errorStatusLabels[error.status]} tone={errorStatusTone(error.status)} /></td>
                    <td className="px-3 py-3">
                      {fixRequest ? (
                        <a className="font-bold text-brand-700 hover:underline" href={`/admin/codex-fix-requests/${fixRequest.id}`}>
                          <StatusBadge label={codexFixStatusLabels[fixRequest.status]} tone={errorStatusTone(fixRequest.status)} />
                        </a>
                      ) : (
                        <StatusBadge label="尚未建立" tone="slate" />
                      )}
                    </td>
                    <td className="px-3 py-3">{safeText(error.route, "未記錄")}</td>
                    <td className="px-3 py-3">{safeText(error.module, "未記錄")}</td>
                    <td className="px-3 py-3">{safeText(error.user?.name ?? error.userRole, "未登入或未記錄")}</td>
                    <td className="px-3 py-3">{error.occurrenceCount}</td>
                    <td className="px-3 py-3">{formatDateTime(error.lastSeenAt)}</td>
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
