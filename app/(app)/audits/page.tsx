import { PageHeader, Panel } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { demoAuditForms, demoMode } from "@/lib/demo";

export default async function AuditsPage() {
  await requireUser();
  const forms = demoMode
    ? demoAuditForms
    : await prisma.auditForm.findMany({
        include: { items: { orderBy: { sortOrder: "asc" } }, records: true },
        orderBy: { name: "asc" }
      });

  return (
    <>
      <PageHeader title="稽核表單" description="第一階段提供預設稽核表單與檢查項目；下一階段可加入填寫紀錄與改善追蹤看板。" />
      <div className="grid gap-4 md:grid-cols-2">
        {forms.map((form) => (
          <Panel key={form.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-950">{form.name}</h2>
                <p className="mt-1 text-sm text-slate-500">已建立紀錄 {form.records.length} 筆</p>
              </div>
              <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">{form.isActive ? "啟用" : "停用"}</span>
            </div>
            <div className="mt-4 grid gap-2">
              {form.items.map((item) => (
                <div key={item.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                  {item.sortOrder}. {item.label}（最高 {item.maxScore} 分）
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
