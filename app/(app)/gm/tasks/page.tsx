import { ClipboardPlus, FileText, UserCheck } from "lucide-react";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { Button, Field, PageHeader, Panel, StatusBadge, statusTone } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

function canCreateGmTask(roleKey: string) {
  return ["GENERAL_MANAGER", "SYSTEM_ADMIN", "EXECUTIVE_ASSISTANT"].includes(roleKey);
}

const priorityLabels: Record<TaskPriority, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  URGENT: "緊急"
};

const statusLabels: Record<TaskStatus, string> = {
  NOT_STARTED: "待處理",
  IN_PROGRESS: "進行中",
  WAITING_CONFIRMATION: "已回報",
  REJECTED: "退回修正",
  COMPLETED: "已完成",
  OVERDUE: "逾期",
  CANCELLED: "已取消"
};

const filters = [
  { value: "", label: "全部交辦" },
  { value: "waiting", label: "待處理" },
  { value: "progress", label: "進行中" },
  { value: "reported", label: "已回報" },
  { value: "completed", label: "已完成" },
  { value: "overdue", label: "逾期" }
];

function formatDate(date?: Date | string | null) {
  if (!date) return "未設定";
  return new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
}

function formatDateTime(date?: Date | string | null) {
  if (!date) return "未記錄";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}

function isTaskOverdue(task: { status: TaskStatus; dueDate: Date | null }) {
  if (!task.dueDate || ["COMPLETED", "CANCELLED"].includes(task.status)) return false;
  return task.status === "OVERDUE" || task.dueDate.getTime() < Date.now();
}

function displayStatus(task: { status: TaskStatus; dueDate: Date | null }) {
  return isTaskOverdue(task) ? "OVERDUE" : task.status;
}

function matchesView(task: { status: TaskStatus; dueDate: Date | null }, view: string) {
  const status = displayStatus(task);
  if (view === "waiting") return status === "NOT_STARTED";
  if (view === "progress") return status === "IN_PROGRESS" || status === "REJECTED";
  if (view === "reported") return status === "WAITING_CONFIRMATION";
  if (view === "completed") return status === "COMPLETED";
  if (view === "overdue") return status === "OVERDUE";
  return true;
}

function cleanContent(content: string) {
  return content.replace(/^交辦內容：\n?/u, "").trim();
}

export default async function GmTasksPage({ searchParams }: { searchParams?: { view?: string; created?: string } }) {
  const user = await requireUser();
  const canCreate = canCreateGmTask(user.roleKey);
  const view = searchParams?.view ?? "";

  const taskScope =
    user.roleKey === "SYSTEM_ADMIN"
      ? {}
      : canCreate
        ? { OR: [{ creatorId: user.id }, { ownerId: user.id }] }
        : { ownerId: user.id };

  const [departments, users, allTasks] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, include: { role: true, department: true }, orderBy: { name: "asc" } }),
    prisma.task.findMany({
      where: {
        sourceType: "gm_assignment",
        ...taskScope
      },
      include: {
        owner: true,
        creator: true,
        department: true,
        attachments: { orderBy: { createdAt: "asc" } },
        comments: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 3 }
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }]
    })
  ]);

  const tasks = allTasks.filter((task) => matchesView(task, view));
  const counts = {
    waiting: allTasks.filter((task) => displayStatus(task) === "NOT_STARTED").length,
    progress: allTasks.filter((task) => ["IN_PROGRESS", "REJECTED"].includes(displayStatus(task))).length,
    reported: allTasks.filter((task) => displayStatus(task) === "WAITING_CONFIRMATION").length,
    completed: allTasks.filter((task) => displayStatus(task) === "COMPLETED").length,
    overdue: allTasks.filter((task) => displayStatus(task) === "OVERDUE").length
  };

  return (
    <>
      <PageHeader
        title="總經理交辦"
        description={canCreate ? "發派任務、查看回報與追蹤進度。" : "查看指派給你的交辦任務，並回報處理進度。"}
      />

      {searchParams?.created ? (
        <Panel className="mb-5 border-emerald-200 bg-emerald-50">
          <p className="text-lg font-bold text-emerald-800">交辦任務已建立，系統已通知被指派人。</p>
        </Panel>
      ) : null}

      <div className="mb-5 grid gap-3 md:grid-cols-5">
        <Panel className="p-4"><Stat label="待處理" value={counts.waiting} /></Panel>
        <Panel className="p-4"><Stat label="進行中" value={counts.progress} /></Panel>
        <Panel className="p-4"><Stat label="已回報" value={counts.reported} /></Panel>
        <Panel className="p-4"><Stat label="已完成" value={counts.completed} /></Panel>
        <Panel className="p-4"><Stat label="逾期" value={counts.overdue} urgent /></Panel>
      </div>

      {canCreate ? (
        <details className="mb-5 rounded-lg border border-brand-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg bg-brand-700 px-5 py-4 text-xl font-black text-white">
            <span className="inline-flex items-center gap-2"><ClipboardPlus className="h-5 w-5" />新增交辦</span>
            <span className="text-base font-semibold">點此展開</span>
          </summary>
          <form action="/api/gm/tasks" method="post" encType="multipart/form-data" className="grid gap-4 p-5">
            <Field label="任務標題">
              <input name="title" required placeholder="例如：仁武館冷氣維修追蹤" />
            </Field>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="指派部門">
                <select name="departmentId" required defaultValue="">
                  <option value="" disabled>請選擇部門</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </Field>
              <Field label="指派人員">
                <select name="ownerId" required defaultValue="">
                  <option value="" disabled>請選擇人員</option>
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}（{item.role.name} / {item.department?.name ?? "未分部門"}）
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="截止日期">
                <input name="dueDate" type="date" required />
              </Field>
              <Field label="優先級">
                <select name="priority" defaultValue="MEDIUM">
                  {Object.values(TaskPriority).map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}
                </select>
              </Field>
            </div>
            <Field label="交辦內容">
              <textarea name="content" rows={5} required placeholder="請寫清楚要做什麼、完成標準、何時回報。" />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 font-semibold">
                <input name="requiresReport" type="checkbox" defaultChecked />
                需要回報進度
              </label>
              <Field label="附件">
                <input name="attachments" type="file" multiple />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button className="min-h-14 px-8 text-xl" type="submit">
                <ClipboardPlus className="h-5 w-5" />建立交辦
              </Button>
            </div>
          </form>
        </details>
      ) : null}

      <Panel className="mb-5">
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <a
              key={filter.value}
              href={`/gm/tasks${filter.value ? `?view=${filter.value}` : ""}`}
              className={`rounded-md px-4 py-3 text-base font-bold ${
                view === filter.value ? "bg-brand-700 text-white" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              }`}
            >
              {filter.label}
            </a>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4">
        {tasks.map((task) => {
          const status = displayStatus(task);
          const canReport = task.ownerId === user.id && !["COMPLETED", "CANCELLED"].includes(task.status);
          return (
            <Panel key={task.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">{task.title}</h2>
                  <p className="mt-2 whitespace-pre-wrap text-lg font-semibold leading-8 text-slate-800">{cleanContent(task.content)}</p>
                  <div className="mt-3 grid gap-1 text-base text-slate-700 md:grid-cols-2">
                    <p><UserCheck className="mr-1 inline h-4 w-4" />負責人：{task.owner.name}</p>
                    <p>指派部門：{task.department?.name ?? "未指定"}</p>
                    <p>截止日期：{formatDate(task.dueDate)}</p>
                    <p>最後更新：{formatDateTime(task.updatedAt)}</p>
                    <p>建立人：{task.creator.name}</p>
                    <p>目前進度：{task.progress}%</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={priorityLabels[task.priority]} />
                  <StatusBadge label={statusLabels[status]} tone={statusTone(status)} />
                </div>
              </div>
              <div className="mt-5 h-4 rounded-full bg-slate-100">
                <div className="h-4 rounded-full bg-brand-700" style={{ width: `${Math.min(Math.max(task.progress, 0), 100)}%` }} />
              </div>
              {task.reportContent ? (
                <div className="mt-4 rounded-lg border border-brand-100 bg-brand-50 p-4">
                  <p className="font-black text-brand-900">最新回報</p>
                  <p className="mt-1 whitespace-pre-wrap text-base font-semibold text-slate-800">{task.reportContent}</p>
                </div>
              ) : null}
              {task.attachments.length > 0 ? (
                <div className="mt-4 rounded-lg border border-slate-200 p-4">
                  <p className="font-black text-slate-900"><FileText className="mr-1 inline h-4 w-4" />附件</p>
                  <ul className="mt-2 grid gap-1 text-base text-slate-700">
                    {task.attachments.map((attachment) => <li key={attachment.id}>{attachment.fileName}</li>)}
                  </ul>
                </div>
              ) : null}
              {task.comments.length > 0 ? (
                <div className="mt-4 grid gap-2">
                  {task.comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg bg-slate-50 p-3">
                      <p className="font-bold text-slate-950">{comment.author.name} · {formatDateTime(comment.createdAt)}</p>
                      <p className="mt-1 whitespace-pre-wrap text-base text-slate-700">{comment.content}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {canReport ? (
                <form action={`/api/gm/tasks/${task.id}/report`} method="post" encType="multipart/form-data" className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <Field label="進度百分比">
                    <input name="progress" type="range" min="0" max="100" defaultValue={task.progress} />
                  </Field>
                  <Field label="進度回報">
                    <textarea name="reportContent" rows={4} required placeholder="請回報目前完成狀況、遇到的問題或需要主管協助的地方。" />
                  </Field>
                  <Field label="附件">
                    <input name="attachments" type="file" multiple />
                  </Field>
                  <Button type="submit">送出進度回報</Button>
                </form>
              ) : null}
            </Panel>
          );
        })}
        {tasks.length === 0 ? (
          <Panel><p className="text-center text-lg font-bold text-slate-600">目前沒有符合條件的交辦任務。</p></Panel>
        ) : null}
      </div>
    </>
  );
}

function Stat({ label, value, urgent = false }: { label: string; value: number; urgent?: boolean }) {
  return (
    <div>
      <p className="text-base font-bold text-slate-600">{label}</p>
      <p className={`mt-1 text-3xl font-black ${urgent && value > 0 ? "text-red-700" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}
