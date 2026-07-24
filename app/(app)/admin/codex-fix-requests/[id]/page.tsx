import { redirect } from "next/navigation";

import { Button, LinkButton, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { codexFixStatusLabels, errorSeverityLabels, errorSeverityTone, errorStatusTone } from "@/lib/error-labels";
import { formatDateTime, safeText } from "@/lib/labels";
import { canAccessErrorCommandCenter } from "@/lib/error-command-center";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export default async function CodexFixRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canAccessErrorCommandCenter(user)) {
    redirect("/dashboard");
  }

  const fixRequest = await prisma.codexFixRequest.findUnique({
    where: { id },
    include: { errorReport: true, createdBy: true }
  });
  if (!fixRequest) {
    return (
      <Panel>
        <p className="text-slate-700">找不到這張 Codex 修復單。</p>
      </Panel>
    );
  }

  return (
    <>
      <PageHeader
        title={fixRequest.title}
        description="此頁顯示已淨化後的 Codex 修復內容，可寫入 CODEX_INBOX 或建立 GitHub Issue。"
        actions={
          <>
            <LinkButton href={`/admin/errors/${fixRequest.errorReportId}`} variant="secondary">返回錯誤詳情</LinkButton>
            <LinkButton href="/admin/errors" variant="secondary">錯誤列表</LinkButton>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel><p className="text-sm font-bold text-slate-500">等級</p><div className="mt-2"><StatusBadge label={errorSeverityLabels[fixRequest.severity]} tone={errorSeverityTone(fixRequest.severity)} /></div></Panel>
        <Panel><p className="text-sm font-bold text-slate-500">修復單狀態</p><div className="mt-2"><StatusBadge label={codexFixStatusLabels[fixRequest.status]} tone={errorStatusTone(fixRequest.status)} /></div></Panel>
        <Panel><p className="text-sm font-bold text-slate-500">建立者</p><p className="mt-2 text-lg font-black text-slate-950">{safeText(fixRequest.createdBy?.name, "系統自動建立")}</p></Panel>
        <Panel><p className="text-sm font-bold text-slate-500">建立時間</p><p className="mt-2 text-lg font-black text-slate-950">{formatDateTime(fixRequest.createdAt)}</p></Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <Panel>
          <h2 className="text-2xl font-black text-slate-950">Codex prompt</h2>
          <pre className="mt-4 max-h-[680px] overflow-auto rounded-lg bg-slate-950 p-4 text-sm leading-6 text-slate-100">{fixRequest.codexPrompt}</pre>
        </Panel>

        <div className="grid gap-5">
          <Panel>
            <h2 className="text-2xl font-black text-slate-950">動作</h2>
            <div className="mt-4 grid gap-3">
              <form action={`/api/codex-fix-requests/${fixRequest.id}/write-inbox`} method="post">
                <Button className="w-full" type="submit">寫入 CODEX_INBOX</Button>
              </form>
              <form action={`/api/codex-fix-requests/${fixRequest.id}/github-issue`} method="post">
                <Button className="w-full" type="submit" variant="secondary">建立 GitHub Issue（需要設定 token）</Button>
              </form>
              {fixRequest.githubIssueUrl ? (
                <a className="rounded-md border border-slate-300 bg-white px-4 py-3 text-center font-bold text-brand-700 hover:bg-slate-50" href={fixRequest.githubIssueUrl}>
                  查看 GitHub Issue
                </a>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-2xl font-black text-slate-950">修復單內容</h2>
            <dl className="mt-4 grid gap-3 text-base">
              <div><dt className="font-bold text-slate-700">來源錯誤</dt><dd><a className="text-brand-700 hover:underline" href={`/admin/errors/${fixRequest.errorReportId}`}>{fixRequest.errorReport.title}</a></dd></div>
              <div><dt className="font-bold text-slate-700">route（頁面）</dt><dd>{safeText(fixRequest.errorReport.route, "未記錄")}</dd></div>
              <div><dt className="font-bold text-slate-700">module（模組）</dt><dd>{safeText(fixRequest.errorReport.module, "未記錄")}</dd></div>
              <div><dt className="font-bold text-slate-700">寫入 Codex 時間</dt><dd>{formatDateTime(fixRequest.sentToCodexAt)}</dd></div>
            </dl>
          </Panel>

          <Panel>
            <h2 className="text-2xl font-black text-slate-950">suspected files（可能相關檔案）</h2>
            <pre className="mt-4 max-h-[260px] overflow-auto rounded-lg bg-slate-950 p-4 text-sm leading-6 text-slate-100">{fixRequest.suspectedFilesJson || "未記錄"}</pre>
          </Panel>
        </div>
      </div>
    </>
  );
}
