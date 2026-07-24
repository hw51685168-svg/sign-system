import { Megaphone } from "lucide-react";
import { Button, Field, PageHeader, Panel } from "@/components/ui";
import { visibleDepartmentOptions, visibleStoreOptions } from "@/lib/org-options";
import { prisma } from "@/lib/prisma";
import { canApprove } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { demoDepartments, demoMode, demoStores } from "@/lib/demo";

export default async function NewAnnouncementPage() {
  const user = await requireUser();
  if (!canApprove(user)) {
    return (
      <Panel>
        <p className="text-sm text-slate-600">你目前沒有發布公告權限。</p>
      </Panel>
    );
  }
  const [departments, stores] = demoMode
    ? [demoDepartments, demoStores]
    : await Promise.all([
        prisma.department.findMany({ orderBy: { name: "asc" } }),
        prisma.store.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })
      ]);
  const departmentOptions = visibleDepartmentOptions(departments);
  const storeOptions = visibleStoreOptions(stores);

  return (
    <>
      <PageHeader title="新增公告" description="發布給全公司、指定部門或指定門市，並可要求已讀確認。" />
      <Panel>
        <form action="/api/announcements" method="post" encType="multipart/form-data" className="grid gap-5">
          <Field label="公告標題">
            <input name="title" required placeholder="例如：7 月門市教育訓練通知、颱風天營業調整公告" />
          </Field>
          <Field label="公告內容">
            <textarea
              name="content"
              required
              placeholder="請寫清楚公告對象、開始時間、需要同仁做什麼、是否要回覆確認。例如：請各館別主管於週五前確認 7 月訓練名單，閱讀後請按已讀確認。"
            />
          </Field>
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="發布範圍">
              <select name="targetType">
                <option value="ALL">全公司</option>
                <option value="DEPARTMENT">指定部門</option>
                <option value="STORE">指定門市</option>
              </select>
            </Field>
            <Field label="指定部門">
              <select name="departmentId">
                <option value="">未指定</option>
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="指定門市">
              <select name="storeId">
                <option value="">未指定</option>
                {storeOptions.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input className="h-4 w-4" type="checkbox" name="requireConfirmation" defaultChecked />
            需要已讀確認
          </label>
          <Field label="附件">
            <input name="attachments" type="file" multiple />
          </Field>
          <div className="flex justify-end">
            <Button type="submit">
              <Megaphone className="h-4 w-4" />
              發布公告
            </Button>
          </div>
        </form>
      </Panel>
    </>
  );
}
