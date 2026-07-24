import { ErrorReportStatus } from "@prisma/client";
import { redirect } from "next/navigation";

import { Button, LinkButton, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { codexFixStatusLabels, errorSeverityLabels, errorSeverityTone, errorStatusLabels, errorStatusTone } from "@/lib/error-labels";
import { formatDateTime, safeText } from "@/lib/labels";
import { canAccessErrorCommandCenter } from "@/lib/error-command-center";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export default async function AdminErrorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canAccessErrorCommandCenter(user)) {
    redirect("/dashboard");
  }

  const error = await prisma.errorReport.findUnique({
    where: { id },
    include: {
      user: true,
      resolvedBy: true,
      breadcrumbs: { orderBy: { timestamp: "desc" }, take: 50 },
      codexFixRequests: true,
      attachments: true
    }
  });
  if (!error) {
    return (
      <Panel>
        <p className="text-slate-700">找不到這筆錯誤紀錄。</p>
      </Panel>
    );
  }

  const fixRequest = error.codexFixRequests[0];
  const statuses = Object.values(ErrorReportStatus);

  return (
    <>
      <PageHeader
        title={error.title}
        description="此頁只顯示已淨化後的錯誤資訊，token、cookie、.env、密碼與敏感資料不會顯示。更新錯誤狀態時，對應 Codex 修復單狀態會同步更新。"
        actions={
          <>
            <LinkButton href="/admin/errors" variant="secondary">返回錯誤列表</LinkButton>
            {fixRequest ? <LinkButton href={`/admin/codex-fix-requests/${fixRequest.id}`}>查看 Codex 修復單</LinkButton> : null}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Panel><p className="text-sm font-bold text-slate-500">等級</p><div className="mt-2"><StatusBadge label={errorSeverityLabels[error.severity]} tone={errorSeverityTone(error.severity)} /></div></Panel>
        <Panel><p className="text-sm font-bold text-slate-500">錯誤狀態</p><div className="mt-2"><StatusBadge label={errorStatusLabels[error.status]} tone={errorStatusTone(error.status)} /></div></Panel>
        <Panel><p className="text-sm font-bold text-slate-500">修復單狀態</p><div className="mt-2">{fixRequest ? <StatusBadge label={codexFixStatusLabels[fixRequest.status]} tone={errorStatusTone(fixRequest.status)} /> : <StatusBadge label="尚未建立" tone="slate" />}</div></Panel>
        <Panel><p className="text-sm font-bold text-slate-500">發生次數</p><p className="mt-2 text-4xl font-black text-slate-950">{error.occurrenceCount}</p></Panel>
        <Panel><p className="text-sm font-bold text-slate-500">最後發生</p><p className="mt-2 text-lg font-black text-slate-950">{formatDateTime(error.lastSeenAt)}</p></Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <Panel>
          <h2 className="text-2xl font-black text-slate-950">錯誤內容</h2>
          <dl className="mt-4 grid gap-3 text-base md:grid-cols-2">
            <div><dt className="font-bold text-slate-700">message（錯誤訊息）</dt><dd>{error.message}</dd></div>
            <div><dt className="font-bold text-slate-700">module（模組）</dt><dd>{safeText(error.module, "未記錄")}</dd></div>
            <div><dt className="font-bold text-slate-700">route（頁面路徑）</dt><dd>{safeText(error.route, "未記錄")}</dd></div>
            <div><dt className="font-bold text-slate-700">action（操作）</dt><dd>{safeText(error.action, "未記錄")}</dd></div>
            <div><dt className="font-bold text-slate-700">使用者</dt><dd>{safeText(error.user?.name ?? error.userRole, "未登入或未記錄")}</dd></div>
            <div><dt className="font-bold text-slate-700">裝置</dt><dd>{safeText(error.deviceType)} / {safeText(error.browser)} / {safeText(error.os)}</dd></div>
            <div><dt className="font-bold text-slate-700">app version（版本）</dt><dd>{safeText(error.appVersion)}</dd></div>
            <div><dt className="font-bold text-slate-700">commit hash</dt><dd>{safeText(error.commitHash)}</dd></div>
            <div><dt className="font-bold text-slate-700">request id</dt><dd>{safeText(error.requestId, "未記錄")}</dd></div>
            <div><dt className="font-bold text-slate-700">session id</dt><dd>{safeText(error.sessionId, "未記錄")}</dd></div>
            <div><dt className="font-bold text-slate-700">處理人</dt><dd>{safeText(error.resolvedBy?.name, "尚未處理")}</dd></div>
            <div><dt className="font-bold text-slate-700">處理時間</dt><dd>{formatDateTime(error.resolvedAt)}</dd></div>
          </dl>
        </Panel>

        <Panel>
          <h2 className="text-2xl font-black text-slate-950">處理動作</h2>
          <div className="mt-4 grid gap-3">
            <form action={`/api/errors/${error.id}/status`} method="post" className="grid gap-2">
              <select name="status" defaultValue={error.status}>
                {statuses.map((status) => (
                  <option key={status} value={status}>{errorStatusLabels[status]}</option>
                ))}
              </select>
              <Button type="submit" variant="secondary">更新錯誤狀態</Button>
            </form>
            {!fixRequest ? (
              <form action={`/api/errors/${error.id}/codex-fix`} method="post" className="grid gap-2">
                <label className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 font-semibold">
                  <input type="checkbox" name="writeInbox" value="true" defaultChecked={error.severity === "P0"} />
                  同時寫入 CODEX_INBOX
                </label>
                <Button type="submit">建立 Codex 修復單</Button>
              </form>
            ) : (
              <LinkButton href={`/admin/codex-fix-requests/${fixRequest.id}`}>查看 Codex 修復單</LinkButton>
            )}
            {error.githubIssueUrl ? <a className="font-bold text-brand-700 hover:underline" href={error.githubIssueUrl}>查看 GitHub Issue</a> : null}
          </div>
        </Panel>
      </div>

      <Panel className="mt-5">
        <h2 className="text-2xl font-black text-slate-950">sanitized stack trace（已淨化錯誤堆疊）</h2>
        <pre className="mt-4 max-h-[420px] overflow-auto rounded-lg bg-slate-950 p-4 text-sm leading-6 text-slate-100">{error.stackTraceSanitized || "未記錄 stack trace"}</pre>
      </Panel>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel>
          <h2 className="text-2xl font-black text-slate-950">breadcrumbs（操作軌跡）</h2>
          <div className="mt-4 grid gap-3">
            {error.breadcrumbs.map((breadcrumb) => (
              <div key={breadcrumb.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-bold text-slate-950">{breadcrumb.type} / {breadcrumb.label}</p>
                <p className="mt-1 text-sm text-slate-600">{safeText(breadcrumb.route, "未記錄")} / {formatDateTime(breadcrumb.timestamp)}</p>
              </div>
            ))}
            {error.breadcrumbs.length === 0 ? <p className="text-slate-600">尚未記錄操作軌跡。</p> : null}
          </div>
        </Panel>
        <Panel>
          <h2 className="text-2xl font-black text-slate-950">sanitized context（已淨化上下文）</h2>
          <pre className="mt-4 max-h-[360px] overflow-auto rounded-lg bg-slate-950 p-4 text-sm leading-6 text-slate-100">{error.contextJsonSanitized || "未記錄 context"}</pre>
        </Panel>
      </div>
    </>
  );
}
