import { Megaphone } from "lucide-react";
import { Button, Field, PageHeader, Panel } from "@/components/ui";
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

  return (
    <>
      <PageHeader title="新增公告" description="發布給全公司、指定部門或指定門市，並可要求已讀確認。" />
      <Panel>
        <form action="/api/announcements" method="post" encType="multipart/form-data" className="grid gap-5">
          <Field label="公告標題">
            <input name="title" required />
          </Field>
          <Field label="公告內容">
            <textarea name="content" required />
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
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="指定門市">
              <select name="storeId">
                <option value="">未指定</option>
                {stores.map((store) => (
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
