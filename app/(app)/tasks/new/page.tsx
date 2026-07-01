import { TaskPriority } from "@prisma/client";
import { ClipboardPlus } from "lucide-react";
import { Button, Field, PageHeader, Panel } from "@/components/ui";
import { taskPriorityLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { canAssignTasks, canViewAllBusinessData, dataScope } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { demoDepartments, demoMode, demoUsers } from "@/lib/demo";

export default async function NewTaskPage() {
  const user = await requireUser();
  if (!canAssignTasks(user)) {
    return <Panel><p className="text-sm text-slate-600">你目前沒有新增任務權限。</p></Panel>;
  }
  const canSeeAll = canViewAllBusinessData(user);
  const scope = dataScope(user);
  const [users, departments] = demoMode
    ? [demoUsers, demoDepartments]
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
        })
      ]);

  return (
    <>
      <PageHeader title="新增任務" description="建立任務並指定負責人、協助人、期限與優先程度。" />
      <Panel>
        <form action="/api/tasks" method="post" encType="multipart/form-data" className="grid gap-5">
          <Field label="任務名稱"><input name="title" required /></Field>
          <Field label="任務內容"><textarea name="content" required /></Field>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="負責人">
              <select name="ownerId" required>
                {users.map((item) => <option key={item.id} value={item.id}>{item.name}（{item.role.name}）</option>)}
              </select>
            </Field>
            <Field label="協助人">
              <select name="assistantIds" multiple>
                {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="所屬部門">
              <select name="departmentId">
                <option value="">未指定</option>
                {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="截止日期"><input name="dueDate" type="date" /></Field>
            <Field label="優先程度">
              <select name="priority">
                {Object.values(TaskPriority).map((priority) => <option key={priority} value={priority}>{taskPriorityLabels[priority]}</option>)}
              </select>
            </Field>
            <Field label="附件或照片"><input name="attachments" type="file" multiple /></Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit"><ClipboardPlus className="h-4 w-4" />建立任務</Button>
          </div>
        </form>
      </Panel>
    </>
  );
}
