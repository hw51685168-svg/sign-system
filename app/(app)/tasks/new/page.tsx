import { TaskPriority } from "@prisma/client";
import { ClipboardPlus } from "lucide-react";
import { AndroidDateInput } from "@/components/android-date-input";
import { AndroidSelectInput } from "@/components/android-select-input";
import { FileInputPreview } from "@/components/file-input-preview";
import { Button, Field, PageHeader, Panel } from "@/components/ui";
import { taskPriorityLabels } from "@/lib/labels";
import { visibleUnitOptions } from "@/lib/org-options";
import { prisma } from "@/lib/prisma";
import { canAssignTasks, canViewAllBusinessData, dataScope } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { demoDepartments, demoMode, demoStores, demoUsers } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewTaskPage() {
  const user = await requireUser();
  if (!canAssignTasks(user)) {
    return <Panel><p className="text-sm text-slate-600">你目前沒有新增任務權限。</p></Panel>;
  }
  const canSeeAll = canViewAllBusinessData(user);
  const scope = dataScope(user);
  const [users, departments, stores] = demoMode
    ? [demoUsers, demoDepartments, demoStores]
    : await Promise.all([
        prisma.user.findMany({
          where: canSeeAll
            ? { isActive: true }
            : scope === "STORE" && user.storeId
              ? { isActive: true, storeId: user.storeId }
              : user.departmentId
                ? { isActive: true, departmentId: user.departmentId }
                : { id: user.id },
          include: { role: true, department: true },
          orderBy: { name: "asc" }
        }),
        prisma.department.findMany({
          where: canSeeAll ? {} : user.departmentId ? { id: user.departmentId } : { id: "__NO_DEPARTMENT__" },
          orderBy: { name: "asc" }
        }),
        prisma.store.findMany({
          where: canSeeAll ? { isActive: true } : user.storeId ? { id: user.storeId, isActive: true } : { id: "__NO_STORE__" },
          orderBy: { name: "asc" }
        })
      ]);
  const unitOptions = visibleUnitOptions(departments, stores);
  const ownerOptions = users.map((item) => ({ value: item.id, label: `${item.name}（${item.role.name}）` }));
  const unitSelectOptions = [{ value: "", label: "未指定" }, ...unitOptions.map((item) => ({ value: item.value, label: item.name }))];
  const priorityOptions = Object.values(TaskPriority).map((priority) => ({ value: priority, label: taskPriorityLabels[priority] }));

  return (
    <>
      <PageHeader title="派發任務" description="選人、寫清楚要做什麼。" />
      <Panel>
        <form action="/api/tasks" method="post" encType="multipart/form-data" className="grid gap-5">
          <Field label="這件事要交給誰？">
            <AndroidSelectInput name="ownerId" options={ownerOptions} required />
          </Field>
          <Field label="任務名稱">
            <input name="title" required placeholder="例：確認 7 月活動採購單據" />
          </Field>
          <Field label="要完成什麼？">
            <textarea
              name="content"
              required
              rows={4}
              placeholder="例：請補上活動照片檔名與發票影本，會計收到後完成核銷。"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="什麼時候完成？">
              <AndroidDateInput name="dueDate" />
            </Field>
            <Field label="完成後怎麼回報？">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold text-slate-700">
                完成後請在任務裡回報結果。
              </div>
            </Field>
          </div>
          <Field label="加照片 / 檔案">
            <FileInputPreview name="attachments" note="可附照片、PDF 或文件。" />
          </Field>

          <details className="rounded-lg border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer px-4 py-3 text-base font-black text-slate-900">進階設定</summary>
            <div className="grid gap-4 border-t border-slate-200 p-4 md:grid-cols-2">
              <Field label="交給哪個單位？">
                <AndroidSelectInput name="unitId" options={unitSelectOptions} />
              </Field>
              <Field label="急不急？">
                <AndroidSelectInput name="priority" options={priorityOptions} defaultValue="MEDIUM" />
              </Field>
              <Field label="還要通知誰？">
                <div className="grid max-h-72 gap-2 overflow-auto rounded-lg border border-slate-200 bg-white p-3">
                  {users.map((item) => (
                    <label key={item.id} className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 text-base font-black text-slate-900">
                      <input className="h-5 w-5 min-h-0 rounded border-slate-300 p-0" name="assistantIds" type="checkbox" value={item.id} />
                      <span>{item.name}</span>
                    </label>
                  ))}
                </div>
              </Field>
              <div className="rounded-lg border border-brand-100 bg-white p-4 text-sm font-semibold leading-6 text-slate-600">
                建立人：{user.name}。協助人只會一起被通知，主要負責人仍以上方選擇為準。
              </div>
            </div>
          </details>
          <div className="flex justify-end">
            <Button type="submit" className="min-h-14 px-8 text-xl"><ClipboardPlus className="h-5 w-5" />派發任務</Button>
          </div>
        </form>
      </Panel>
    </>
  );
}
