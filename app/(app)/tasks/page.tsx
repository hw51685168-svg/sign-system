import { Plus, Search } from "lucide-react";
import { EmptyState, LinkButton, PageHeader, Panel, StatusBadge, statusTone } from "@/components/ui";
import { formatDate, formatDateTime, safeText, taskPriorityLabels, taskStatusLabels } from "@/lib/labels";
import { parseUnitValue, visibleUnitOptions } from "@/lib/org-options";
import { prisma } from "@/lib/prisma";
import { canAssignTasks, canViewAllBusinessData, dataScope, scopedTaskWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusFilterMap: Record<string, string[]> = {
  today: [],
  pending: ["NOT_STARTED"],
  in_progress: ["IN_PROGRESS"],
  pending_review: ["WAITING_CONFIRMATION"],
  completed: ["COMPLETED"],
  rejected: ["REJECTED"],
  overdue: ["OVERDUE"],
  cancelled: ["CANCELLED"]
};

export default async function TasksPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; status?: string; departmentId?: string; unitId?: string; ownerId?: string; priority?: string; sort?: string }>;
}) {
  const parsedSearchParams = (await searchParams) ?? {};
  const user = await requireUser();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const status = parsedSearchParams.status ?? "";
  const q = parsedSearchParams.q?.trim();
  const canSeeAll = canViewAllBusinessData(user);
  const scope = dataScope(user);
  const unitFilter = parseUnitValue(parsedSearchParams.unitId);

  const tasks = await prisma.task.findMany({
    where: {
      AND: [
        scopedTaskWhere(user),
        q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }] } : {},
        status === "today" ? { dueDate: { gte: todayStart, lte: todayEnd }, status: { notIn: ["COMPLETED", "CANCELLED"] } } : {},
        status && status !== "today" && statusFilterMap[status] ? { status: { in: statusFilterMap[status] as any } } : {},
        !status ? { status: { not: "CANCELLED" } } : {},
        unitFilter ? (unitFilter.type === "department" ? { departmentId: unitFilter.id } : { storeId: unitFilter.id }) : parsedSearchParams.departmentId ? { departmentId: parsedSearchParams.departmentId } : {},
        parsedSearchParams.ownerId ? { ownerId: parsedSearchParams.ownerId } : {},
        parsedSearchParams.priority ? { priority: parsedSearchParams.priority as any } : {}
      ]
    },
    include: {
      owner: true,
      creator: true,
      department: true,
      assistants: { include: { user: true } },
      comments: true,
      attachments: true
    },
    orderBy: parsedSearchParams.sort === "updated" ? [{ updatedAt: "desc" }] : [{ dueDate: "asc" }, { updatedAt: "desc" }]
  });

  const [departments, stores, owners] = await Promise.all([
    prisma.department.findMany({
      where: canSeeAll ? {} : user.departmentId ? { id: user.departmentId } : { id: "__NO_DEPARTMENT__" },
      orderBy: { name: "asc" }
    }),
    prisma.store.findMany({
      where: canSeeAll ? { isActive: true } : user.storeId ? { id: user.storeId, isActive: true } : { id: "__NO_STORE__" },
      orderBy: { name: "asc" }
    }),
    prisma.user.findMany({
      where: canSeeAll
        ? { isActive: true }
        : scope === "STORE" && user.storeId
          ? { isActive: true, storeId: user.storeId }
          : { id: user.id },
      orderBy: { name: "asc" }
    })
  ]);
  const unitOptions = visibleUnitOptions(departments, stores);

  return (
    <>
      <PageHeader
        title="任務中心"
        description="列表只顯示摘要。點進任務詳情後再更新狀態、回報內容與附件。"
        actions={canAssignTasks(user) ? <LinkButton href="/tasks/new"><Plus className="h-5 w-5" />新增任務</LinkButton> : null}
      />

      <Panel className="mb-5">
        <form className="grid gap-3 lg:grid-cols-[1.5fr_repeat(5,1fr)_auto]" action="/tasks">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
            <input className="w-full pl-10" name="q" defaultValue={q} placeholder="搜尋任務標題或內容" />
          </div>
          <select name="status" defaultValue={status}>
            <option value="">全部狀態</option>
            <option value="today">今日待辦</option>
            <option value="pending">待辦</option>
            <option value="in_progress">進行中</option>
            <option value="pending_review">待審核</option>
            <option value="completed">已完成</option>
            <option value="rejected">駁回修改</option>
            <option value="overdue">已逾期</option>
          </select>
          <select name="unitId" defaultValue={parsedSearchParams.unitId ?? ""}>
            <option value="">全部單位</option>
            {unitOptions.map((unit) => <option key={unit.value} value={unit.value}>{unit.name}</option>)}
          </select>
          <select name="ownerId" defaultValue={parsedSearchParams.ownerId ?? ""}>
            <option value="">全部接收人</option>
            {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
          </select>
          <select name="priority" defaultValue={parsedSearchParams.priority ?? ""}>
            <option value="">全部優先級</option>
            {Object.entries(taskPriorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select name="sort" defaultValue={parsedSearchParams.sort ?? ""}>
            <option value="">依期限排序</option>
            <option value="updated">依更新時間</option>
          </select>
          <button className="min-h-12 rounded-md bg-brand-700 px-5 text-base font-bold text-white" type="submit">篩選</button>
        </form>
      </Panel>

      {tasks.length === 0 ? (
        <EmptyState title="沒有符合條件的任務" description="請調整搜尋或篩選條件，或建立新的任務。" />
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => (
            <a key={task.id} href={`/tasks/${task.id}`} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft transition hover:border-brand-300 hover:bg-brand-50">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h2 className="text-2xl font-black text-slate-950">{safeText(task.title, "未命名任務")}</h2>
                  <p className="mt-2 line-clamp-2 text-base leading-7 text-slate-700">{safeText(task.content, "尚無內容")}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-base text-slate-700">
                    <span>接收人：<strong>{safeText(task.owner.name, "未指定")}</strong></span>
                    <span>接收部門：<strong>{safeText(task.department?.name, "未指定")}</strong></span>
                    <span>截止：<strong>{formatDate(task.dueDate)}</strong></span>
                    <span>最近更新：<strong>{formatDateTime(task.updatedAt)}</strong></span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <StatusBadge label={taskPriorityLabels[task.priority]} />
                  <StatusBadge label={taskStatusLabels[task.status]} tone={statusTone(task.status)} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
                <span>留言 {task.comments.length}</span>
                <span>附件 {task.attachments.length}</span>
                <span>協助人 {task.assistants.length}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
