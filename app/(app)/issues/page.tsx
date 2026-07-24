import { IssueSeverity, IssueType } from "@prisma/client";
import { AlertCircle } from "lucide-react";
import { Button, Field, PageHeader, Panel, StatusBadge, statusTone } from "@/components/ui";
import { formatDateTime, issueSeverityLabels, issueStatusLabels, issueTypeLabels } from "@/lib/labels";
import { visibleDepartmentOptions, visibleStoreOptions } from "@/lib/org-options";
import { prisma } from "@/lib/prisma";
import { scopedIssueWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { demoDepartments, demoIssues, demoMode, demoStores } from "@/lib/demo";

export default async function IssuesPage() {
  const user = await requireUser();
  const [issues, stores, departments] = demoMode
    ? [demoIssues, demoStores, demoDepartments]
    : await Promise.all([
        prisma.issueReport.findMany({
          where: scopedIssueWhere(user),
          include: { store: true, reporter: true, assignedDepartment: true },
          orderBy: { updatedAt: "desc" }
        }),
        prisma.store.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
        prisma.department.findMany({ orderBy: { name: "asc" } })
      ]);
  const departmentOptions = visibleDepartmentOptions(departments);
  const storeOptions = visibleStoreOptions(stores);

  return (
    <>
      <PageHeader title="門市問題回報" description="門市可快速回報客訴、設備、人員、短缺、系統與緊急事件。" />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Panel>
          <h2 className="mb-4 font-bold text-slate-950">新增問題回報</h2>
          <form action="/api/issues" method="post" encType="multipart/form-data" className="grid gap-4">
            <Field label="門市">
              <select name="storeId" defaultValue={user.storeId ?? ""}>
                <option value="">未指定</option>
                {storeOptions.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
              </select>
            </Field>
            <Field label="問題類型">
              <select name="type">{Object.values(IssueType).map((type) => <option key={type} value={type}>{issueTypeLabels[type]}</option>)}</select>
            </Field>
            <Field label="問題描述">
              <textarea
                name="description"
                required
                placeholder="請寫清楚發生地點、狀況、影響程度與已先做的處理。例如：好腳舍仁武館櫃台電腦登入異常，已重開機仍無法使用，影響現場結帳。"
              />
            </Field>
            <Field label="發生時間"><input name="occurredAt" type="datetime-local" required /></Field>
            <Field label="嚴重程度">
              <select name="severity">{Object.values(IssueSeverity).map((severity) => <option key={severity} value={severity}>{issueSeverityLabels[severity]}</option>)}</select>
            </Field>
            <Field label="交給哪個部門處理">
              <select name="assignedDepartmentId">
                <option value="">先不指定</option>
                {departmentOptions.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </Field>
            <Field label="照片或附件"><input name="attachments" type="file" multiple /></Field>
            <Button type="submit"><AlertCircle className="h-4 w-4" />送出問題回報</Button>
          </form>
        </Panel>

        <Panel>
          <h2 className="mb-4 font-bold text-slate-950">處理追蹤</h2>
          <div className="grid gap-3">
            {issues.map((issue) => (
              <a key={issue.id} href={`/issues/${issue.id}`} className="block rounded-md border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-bold text-slate-950">{issue.store?.name ?? "未指定門市"} · {issueTypeLabels[issue.type as keyof typeof issueTypeLabels]}</p>
                    <p className="mt-1 text-sm text-slate-600">{issue.description}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      回報人：{issue.reporter.name} · 發生：{formatDateTime(issue.occurredAt)} · 交給：{issue.assignedDepartment?.name ?? "-"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge label={issueSeverityLabels[issue.severity as keyof typeof issueSeverityLabels]} tone={statusTone(issue.severity)} />
                    <StatusBadge label={issueStatusLabels[issue.status as keyof typeof issueStatusLabels]} tone={statusTone(issue.status)} />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
