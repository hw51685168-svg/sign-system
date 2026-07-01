import { CheckCircle2, Circle } from "lucide-react";
import { redirect } from "next/navigation";
import { PilotBanner } from "@/components/pilot-banner";
import { Button, LinkButton, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { roleLabels } from "@/lib/labels";
import { canAccessPilot, ensurePilotChecklist } from "@/lib/pilot";
import { requireUser } from "@/lib/session";

export default async function PilotChecklistPage() {
  const user = await requireUser();
  if (!canAccessPilot(user)) {
    redirect("/dashboard");
  }

  const items = await ensurePilotChecklist(user);
  const total = items.length;
  const completed = items.filter((item) => item.isCompleted).length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    acc[item.category] = acc[item.category] ?? [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <>
      <PilotBanner compact />
      <PageHeader
        title="主管實測清單"
        description={`目前角色：${roleLabels[user.roleKey] ?? user.roleName}。請依序測試，完成後按「標記完成」。`}
        actions={
          <>
            <StatusBadge label={`${completed}/${total} 完成`} tone={progress >= 80 ? "green" : progress > 0 ? "amber" : "slate"} />
            <LinkButton href="/pilot/feedback" variant="secondary">送出回饋</LinkButton>
          </>
        }
      />

      <Panel>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-black text-slate-950">測試進度</p>
            <p className="mt-1 text-base text-slate-700">完成一項就勾一項，系統會留下 Audit Log（稽核紀錄）。</p>
          </div>
          <p className="text-4xl font-black text-brand-700">{progress}%</p>
        </div>
        <div className="mt-4 h-4 rounded-full bg-slate-100">
          <div className="h-4 rounded-full bg-brand-700" style={{ width: `${progress}%` }} />
        </div>
      </Panel>

      <div className="mt-5 grid gap-5">
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <Panel key={category}>
            <h2 className="mb-4 text-2xl font-black text-slate-950">{category}</h2>
            <div className="grid gap-3">
              {categoryItems.map((item) => (
                <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      {item.isCompleted ? <CheckCircle2 className="mt-1 h-6 w-6 text-emerald-600" /> : <Circle className="mt-1 h-6 w-6 text-slate-400" />}
                      <div>
                        <p className="text-lg font-black text-slate-950">{item.label}</p>
                        {item.notes ? <p className="mt-1 text-sm text-slate-600">備註：{item.notes}</p> : null}
                      </div>
                    </div>
                    <form action="/api/pilot/checklist" method="post" className="flex flex-col gap-2 sm:flex-row">
                      <input type="hidden" name="itemKey" value={item.itemKey} />
                      <input type="hidden" name="isCompleted" value={item.isCompleted ? "false" : "true"} />
                      <input
                        className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
                        name="notes"
                        placeholder="可填測試備註"
                        defaultValue={item.notes ?? ""}
                      />
                      <Button type="submit" variant={item.isCompleted ? "secondary" : "primary"}>
                        {item.isCompleted ? "取消完成" : "標記完成"}
                      </Button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
