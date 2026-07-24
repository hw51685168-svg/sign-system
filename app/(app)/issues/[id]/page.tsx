import { IssueStatus } from "@prisma/client";
import { AlertCircle, Paperclip, Save } from "lucide-react";
import { notFound } from "next/navigation";
import { Button, Field, LinkButton, PageHeader, Panel, StatusBadge, statusTone } from "@/components/ui";
import { VoiceThread } from "@/components/voice-thread";
import { formatDateTime, issueSeverityLabels, issueStatusLabels, issueTypeLabels, safeText } from "@/lib/labels";
import { visibleDepartmentOptions } from "@/lib/org-options";
import { prisma } from "@/lib/prisma";
import { scopedIssueWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { getOrCreateConversation } from "@/lib/voice";

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await requireUser();
  const issue = await prisma.issueReport.findFirst({
    where: { AND: [{ id: resolvedParams.id }, scopedIssueWhere(user)] },
    include: {
      store: true,
      reporter: true,
      assignedDepartment: true,
      assignee: true,
      attachments: { orderBy: { createdAt: "desc" } },
      logs: { include: { actor: true }, orderBy: { createdAt: "desc" } }
    }
  });
  if (!issue) notFound();

  const [departments, users] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, include: { role: true }, orderBy: { name: "asc" } })
  ]);
  const departmentOptions = visibleDepartmentOptions(departments);
  const conversation = await getOrCreateConversation({
    type: "ISSUE",
    sourceType: "issue",
    sourceId: issue.id,
    title: `問題回報：${issueTypeLabels[issue.type]}`,
    departmentId: issue.assignedDepartmentId,
    storeId: issue.storeId,
    createdById: user.id
  });

  return (
    <>
      <PageHeader
        title={`${issue.store?.name ?? "未指定門市"} · ${issueTypeLabels[issue.type]}`}
        description={`回報人：${issue.reporter.name} · 發生時間：${formatDateTime(issue.occurredAt)} · 最近更新：${formatDateTime(issue.updatedAt)}`}
        actions={<LinkButton href="/issues" variant="secondary">返回問題回報</LinkButton>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-6">
          <Panel>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={issueSeverityLabels[issue.severity]} tone={statusTone(issue.severity)} />
              <StatusBadge label={issueStatusLabels[issue.status]} tone={statusTone(issue.status)} />
            </div>
            <dl className="mt-5 grid gap-4 text-base md:grid-cols-2">
              <div><dt className="font-bold text-slate-700">門市</dt><dd>{safeText(issue.store?.name, "未指定")}</dd></div>
              <div><dt className="font-bold text-slate-700">承接部門</dt><dd>{safeText(issue.assignedDepartment?.name, "未指定")}</dd></div>
              <div><dt className="font-bold text-slate-700">承辦人</dt><dd>{safeText(issue.assignee?.name, "未指定")}</dd></div>
              <div><dt className="font-bold text-slate-700">建立時間</dt><dd>{formatDateTime(issue.createdAt)}</dd></div>
            </dl>
            <div className="mt-6 rounded-lg bg-slate-50 p-4 text-lg leading-8 text-slate-800 whitespace-pre-wrap">{safeText(issue.description, "尚無問題描述")}</div>
            {issue.closureNote ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-base leading-7 text-emerald-950">
                <p className="font-black">結案紀錄</p>
                <p className="mt-1 whitespace-pre-wrap">{issue.closureNote}</p>
              </div>
            ) : null}
          </Panel>

          <VoiceThread conversationId={conversation.id} />

          <Panel>
            <h2 className="mb-4 text-2xl font-black text-slate-950">附件與照片</h2>
            {issue.attachments.length === 0 ? <p className="text-slate-700">尚未上傳附件。</p> : null}
            <div className="grid gap-2">
              {issue.attachments.map((attachment) => (
                <a key={attachment.id} href={attachment.fileUrl} target="_blank" className="rounded-md border border-slate-200 px-3 py-2 text-brand-700 hover:bg-slate-50">
                  <Paperclip className="mr-2 inline h-4 w-4" />
                  {attachment.fileName}
                </a>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid h-fit gap-6 xl:sticky xl:top-24">
          <Panel>
            <h2 className="mb-4 text-xl font-black text-slate-950">問題處理</h2>
            <form action={`/api/issues/${issue.id}/actions`} method="post" className="grid gap-4">
              <Field label="狀態">
                <select name="status" defaultValue={issue.status}>
                  {Object.values(IssueStatus).map((status) => <option key={status} value={status}>{issueStatusLabels[status]}</option>)}
                </select>
              </Field>
              <Field label="交給哪個部門處理">
                <select name="assignedDepartmentId" defaultValue={issue.assignedDepartmentId ?? ""}>
                  <option value="">未指定</option>
                  {departmentOptions.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </Field>
              <Field label="承辦人">
                <select name="assigneeId" defaultValue={issue.assigneeId ?? ""}>
                  <option value="">未指定</option>
                  {users.map((item) => <option key={item.id} value={item.id}>{item.name}（{item.role.name}）</option>)}
                </select>
              </Field>
              <Field label="處理說明 / 結案原因">
                <textarea name="comment" placeholder="處理進度、需要補充的資料，或結案時的處理結果。" />
              </Field>
              <div className="grid gap-2">
                <Button name="action" value="UPDATE" type="submit">
                  <Save className="h-4 w-4" />
                  送出更新
                </Button>
                <Button name="action" value="COMMENT" type="submit" variant="secondary">
                  <AlertCircle className="h-4 w-4" />
                  只新增留言
                </Button>
              </div>
            </form>
          </Panel>

          <Panel>
            <h2 className="mb-4 text-xl font-black text-slate-950">歷程紀錄</h2>
            {issue.logs.length === 0 ? <p className="text-slate-700">尚無紀錄。</p> : null}
            <div className="grid gap-3">
              {issue.logs.map((log) => (
                <div key={log.id} className="rounded-md border border-slate-200 p-3">
                  <p className="font-bold text-slate-950">{log.actor.name}</p>
                  <p className="text-sm text-slate-600">{formatDateTime(log.createdAt)}</p>
                  {log.fromStatus || log.toStatus ? (
                    <p className="mt-1 text-sm text-slate-600">
                      {log.fromStatus ? issueStatusLabels[log.fromStatus] : "-"} → {log.toStatus ? issueStatusLabels[log.toStatus] : "-"}
                    </p>
                  ) : null}
                  {log.comment ? <p className="mt-2 whitespace-pre-wrap text-base text-slate-700">{log.comment}</p> : null}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
