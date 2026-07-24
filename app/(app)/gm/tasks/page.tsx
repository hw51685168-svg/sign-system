import { ClipboardPlus, FileText, Trash2, UserCheck } from "lucide-react";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { AttachmentPreviewList } from "@/components/attachment-preview-list";
import { AndroidDateInput } from "@/components/android-date-input";
import { FileInputPreview } from "@/components/file-input-preview";
import { GmTaskFilterLink } from "@/components/gm-task-filter-link";
import { Button, Field, PageHeader, Panel, StatusBadge, statusTone } from "@/components/ui";
import { canWriteTaskCommunication } from "@/lib/communication-permissions";
import { canonicalDepartmentName, visibleUnitOptions } from "@/lib/org-options";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  IN_PROGRESS: "處理中",
  WAITING_CONFIRMATION: "已回報",
  REJECTED: "退回修正",
  COMPLETED: "已結案",
  OVERDUE: "逾期",
  CANCELLED: "已取消"
};

const filters = [
  { value: "", label: "全部交辦" },
  { value: "waiting", label: "待處理" },
  { value: "progress", label: "處理中" },
  { value: "reported", label: "已回報" },
  { value: "completed", label: "已結案" },
  { value: "overdue", label: "逾期" }
];

const gmTaskAssigneeEmails = [
  "yijing@huangxiang.local",
  "yanrou@huangxiang.local",
  "xiaofan@huangxiang.local",
  "michael@huangxiang.local",
  "xiaozhi@huangxiang.local",
  "jiazhen@huangxiang.local",
  "boyuan@huangxiang.local"
];

function buildDepartmentOptions(
  users: Array<{ departmentId: string | null; department: { id: string; name: string } | null }>,
  stores: Array<{ id: string; name: string }>
) {
  const departments = users.flatMap((item) => item.department && item.departmentId ? [{ id: item.department.id, name: item.department.name }] : []);
  return visibleUnitOptions(departments, stores).map((unit) => ({ id: unit.value, label: unit.name }));
}

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
  return status !== "CANCELLED";
}

function cleanContent(content: string) {
  return content.replace(/^交辦內容：\n?/u, "").trim();
}

function canDecideGmTask(user: { id: string; roleKey: string }, task: { creatorId: string }) {
  return ["GENERAL_MANAGER", "SYSTEM_ADMIN"].includes(user.roleKey) || task.creatorId === user.id;
}

export default async function GmTasksPage({
  searchParams
}: {
  searchParams?: Promise<{ view?: string; created?: string; new?: string }>;
}) {
  const parsedSearchParams = (await searchParams) ?? {};
  const user = await requireUser();
  const canCreate = canCreateGmTask(user.roleKey);
  const view = parsedSearchParams.view ?? "";
  const openNewTask = parsedSearchParams.new === "1";

  const taskScope =
    user.roleKey === "SYSTEM_ADMIN"
      ? {}
      : canCreate
        ? { OR: [{ creatorId: user.id }, { ownerId: user.id }] }
        : { ownerId: user.id };

  const [assignmentUsers, stores, allTasks] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        email: { in: gmTaskAssigneeEmails },
        id: { not: user.id }
      },
      include: { role: true, department: true },
      orderBy: { name: "asc" }
    }),
    prisma.store.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
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
        assistants: { select: { userId: true } },
        comments: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 3 }
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }]
    })
  ]);

  const orderedAssignmentUsers = [...assignmentUsers].sort((a, b) => {
    const departmentDiff = canonicalDepartmentName(a.department?.name).localeCompare(canonicalDepartmentName(b.department?.name), "zh-Hant-TW");
    if (departmentDiff !== 0) return departmentDiff;
    return a.name.localeCompare(b.name, "zh-Hant-TW");
  });
  const departmentOptions = buildDepartmentOptions(orderedAssignmentUsers, stores);
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
        description={canCreate ? "發派任務、查看回報與持續溝通。" : "查看指派給你的交辦任務，並回報處理狀況。"}
      />

      {parsedSearchParams?.created ? (
        <Panel className="mb-5 border-emerald-200 bg-emerald-50">
          <p className="text-lg font-bold text-emerald-800">交辦任務已建立，系統已通知被指派人。</p>
        </Panel>
      ) : null}

      <div className="mb-5 grid gap-3 md:grid-cols-5">
        <GmTaskFilterLink href="/gm/tasks?view=waiting#gm-task-list" label="待處理" value={counts.waiting} active={view === "waiting"} />
        <GmTaskFilterLink href="/gm/tasks?view=progress#gm-task-list" label="處理中" value={counts.progress} active={view === "progress"} />
        <GmTaskFilterLink href="/gm/tasks?view=reported#gm-task-list" label="已回報" value={counts.reported} active={view === "reported"} />
        <GmTaskFilterLink href="/gm/tasks?view=completed#gm-task-list" label="已結案" value={counts.completed} active={view === "completed"} />
        <GmTaskFilterLink href="/gm/tasks?view=overdue#gm-task-list" label="逾期" value={counts.overdue} active={view === "overdue"} urgent />
      </div>

      <Panel className="mb-5">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">全部交辦清單</h2>
            <p className="text-base font-semibold text-slate-600">進入此頁會先顯示所有交辦，可再依處理狀態快速篩選。</p>
          </div>
          {canCreate ? (
            <a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-base font-black text-white hover:bg-brand-800" href="/gm/tasks?new=1#new-gm-task">
              <ClipboardPlus className="h-5 w-5" />新增交辦
            </a>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <GmTaskFilterLink
              key={filter.value}
              href={`/gm/tasks${filter.value ? `?view=${filter.value}` : ""}#gm-task-list`}
              label={filter.label}
              active={view === filter.value}
              variant="pill"
            />
          ))}
        </div>
      </Panel>

      <div id="gm-task-list" className="grid gap-4 scroll-mt-24">
        {tasks.map((task) => {
          const status = displayStatus(task);
          const canReport = task.ownerId === user.id && !["WAITING_CONFIRMATION", "COMPLETED", "CANCELLED"].includes(task.status);
          const canDecide = task.status === "WAITING_CONFIRMATION" && canDecideGmTask(user, task);
          const canWriteCommunication = canWriteTaskCommunication(user, task);
          return (
            <div key={task.id} id={`task-${task.id}`} className="scroll-mt-24">
            <Panel>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">{task.title}</h2>
                  <p className="mt-2 whitespace-pre-wrap text-lg font-semibold leading-8 text-slate-800">{cleanContent(task.content)}</p>
                  <div className="mt-3 grid gap-1 text-base text-slate-700 md:grid-cols-2">
                    <p><UserCheck className="mr-1 inline h-4 w-4" />接收人：{task.owner.name}</p>
                    <p>接收部門：{task.department?.name ?? "未指定"}</p>
                    <p>截止日期：{formatDate(task.dueDate)}</p>
                    <p>最後更新：{formatDateTime(task.updatedAt)}</p>
                    <p>建立人：{task.creator.name}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={priorityLabels[task.priority]} />
                  <StatusBadge label={statusLabels[status]} tone={statusTone(status)} />
                </div>
              </div>
              {task.reportContent ? (
                <div className="mt-4 rounded-lg border border-brand-100 bg-brand-50 p-4">
                  <p className="font-black text-brand-900">最新回報</p>
                  <p className="mt-1 whitespace-pre-wrap text-base font-semibold text-slate-800">{task.reportContent}</p>
                </div>
              ) : null}
              {task.status === "WAITING_CONFIRMATION" ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-lg font-black text-amber-950">等待確認結案</p>
                  <p className="mt-1 text-base font-semibold leading-7 text-amber-900">
                    接收人已回報完成，請總經理或交辦建立者確認是否可以結案；若內容不足，請退回續辦並寫明原因。
                  </p>
                </div>
              ) : null}
              {task.status === "COMPLETED" ? (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-lg font-black text-emerald-950">已確認結案</p>
                  <p className="mt-1 text-base font-semibold leading-7 text-emerald-900">
                    這筆交辦已由總經理或交辦建立者確認完成，後續僅保留紀錄查詢。
                  </p>
                </div>
              ) : null}
              {task.attachments.length > 0 ? (
                <div className="mt-4 rounded-lg border border-slate-200 p-4">
                  <p className="font-black text-slate-900"><FileText className="mr-1 inline h-4 w-4" />附件</p>
                  <div className="mt-3">
                    <AttachmentPreviewList attachments={task.attachments} />
                  </div>
                </div>
              ) : null}
              {task.comments.length > 0 ? (
                <div className="mt-4 grid gap-2">
                  {task.comments.map((comment) => (
                    <div id={`comment-${comment.id}`} key={comment.id} className="scroll-mt-24 rounded-lg bg-slate-50 p-3">
                      <p className="font-bold text-slate-950">{comment.author.name} · {formatDateTime(comment.createdAt)}</p>
                      <p className="mt-1 whitespace-pre-wrap text-base text-slate-700">{comment.content}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-5 grid gap-3 rounded-lg border border-brand-100 bg-brand-50 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-lg font-black text-brand-900">催促 / 持續溝通</p>
                    <p className="text-sm font-semibold text-slate-600">可直接打字提醒對方；需要錄音時請進入留言與語音頁。</p>
                  </div>
                  <a
                    href={`/tasks/${task.id}#voice-thread`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-700 bg-white px-4 text-base font-black text-brand-800 hover:bg-brand-50"
                  >
                    留言與語音
                  </a>
                </div>
                {canWriteCommunication ? (
                  <form action={`/api/tasks/${task.id}/comments`} method="post" className="grid gap-3">
                    <input type="hidden" name="returnTo" value={`/gm/tasks${view ? `?view=${view}` : ""}#task-${task.id}`} />
                    <Field label="?? / ??">
                      <textarea
                        name="content"
                        required
                        rows={3}
                        maxLength={1000}
                        placeholder={`??? ${task.owner.name}?????????????????`}
                      />
                    </Field>
                    <div className="flex justify-end">
                      <Button type="submit">????</Button>
                    </div>
                  </form>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-base font-semibold leading-7 text-slate-700">
                    ???????????????????????
                  </div>
                )}
              </div>
              {canReport ? (
                <form action={`/api/gm/tasks/${task.id}/report`} method="post" encType="multipart/form-data" className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-lg font-black text-slate-950">回報給交辦人</p>
                    <p className="mt-1 text-sm font-bold text-slate-600">
                      請先選擇是否已完成，再送出回報。若選擇已完成，系統會送給總經理確認結案。
                    </p>
                  </div>
                  <Field label="是否完成">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 text-base font-black text-slate-900">
                        <input className="h-5 w-5 min-h-0 p-0" name="intent" type="radio" value="progress" defaultChecked />
                        <span>尚未完成，先回報狀況</span>
                      </label>
                      <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 text-base font-black text-slate-900">
                        <input className="h-5 w-5 min-h-0 p-0" name="intent" type="radio" value="complete" />
                        <span>已完成，送總經理確認</span>
                      </label>
                    </div>
                  </Field>
                  <Field label="處理回報">
                    <textarea name="reportContent" rows={4} required placeholder="請寫清楚目前做到哪裡、完成了什麼、是否還需要協助。" />
                  </Field>
                  <Field label="附件">
                    <FileInputPreview name="attachments" note="送出回報前可先確認附件檔名與內容。" />
                  </Field>
                  <Button type="submit" className="min-h-12">
                    送出回報
                  </Button>
                </form>
              ) : null}
              {task.ownerId === user.id && task.status === "WAITING_CONFIRMATION" ? (
                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-base font-black text-amber-950">你已回報完成</p>
                  <p className="mt-1 text-sm font-bold leading-6 text-amber-900">目前等待總經理或交辦建立者確認結案；若需要補充，請使用上方留言通知。</p>
                </div>
              ) : null}
              {canDecide ? (
                <div className="mt-5 grid gap-4 rounded-lg border border-brand-200 bg-white p-4">
                  <div>
                    <p className="text-lg font-black text-brand-950">總經理確認</p>
                    <p className="mt-1 text-sm font-bold text-slate-600">接收人已回報完成，請確認結案，或退回續辦要求補充。</p>
                  </div>
                  <form action={`/api/gm/tasks/${task.id}/decision`} method="post" className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <input type="hidden" name="decision" value="CONFIRM_CLOSE" />
                    <Field label="結案備註（可空白）">
                      <textarea name="note" rows={2} placeholder="例如：已確認處理完成，結案。" />
                    </Field>
                    <Button type="submit" className="min-h-12">
                      確認結案
                    </Button>
                  </form>
                  <form action={`/api/gm/tasks/${task.id}/decision`} method="post" className="grid gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                    <input type="hidden" name="decision" value="RETURN_CONTINUE" />
                    <Field label="退回續辦原因（必填）">
                      <textarea name="note" rows={3} required placeholder="請寫明哪裡還沒完成、要補什麼、希望何時再回報。" />
                    </Field>
                    <Button type="submit" className="min-h-12 bg-red-700 hover:bg-red-800">
                      退回續辦
                    </Button>
                  </form>
                </div>
              ) : null}
              {task.status === "COMPLETED" && canDecideGmTask(user, task) ? (
                <form action={`/api/gm/tasks/${task.id}/delete`} method="post" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-lg font-black text-red-950">刪除已結案交辦</p>
                  <p className="mt-1 text-sm font-bold leading-6 text-red-900">
                    只會從一般交辦清單移除，系統仍保留稽核紀錄、留言與附件紀錄，方便日後追查。
                  </p>
                  <Button type="submit" className="mt-3 min-h-12 bg-red-700 hover:bg-red-800">
                    <Trash2 className="h-4 w-4" />
                    刪除已結案
                  </Button>
                </form>
              ) : null}
            </Panel>
            </div>
          );
        })}
        {tasks.length === 0 ? (
          <Panel><p className="text-center text-lg font-bold text-slate-600">目前沒有符合條件的交辦任務。</p></Panel>
        ) : null}
      </div>

      {canCreate ? (
        <details id="new-gm-task" open={openNewTask} className="mt-5 scroll-mt-24 rounded-lg border border-brand-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg bg-brand-700 px-5 py-4 text-xl font-black text-white">
            <span className="inline-flex items-center gap-2"><ClipboardPlus className="h-5 w-5" />派發任務</span>
            <span className="text-base font-semibold">點此展開</span>
          </summary>
          <form action="/api/gm/tasks" method="post" encType="multipart/form-data" className="grid gap-4 p-5">
            <div className="rounded-lg border border-brand-100 bg-brand-50 p-4">
              <p className="text-lg font-black text-brand-900">這件事要交給誰？</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">選單位和負責人，對方會收到通知。</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="交給哪個單位？">
                <div className="grid max-h-72 gap-2 overflow-auto rounded-lg border border-slate-200 bg-white p-3">
                  {departmentOptions.map((department) => (
                    <label key={department.id} className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 text-base font-black text-slate-900">
                      <input className="h-5 w-5 min-h-0 p-0" name="unitId" type="radio" required value={department.id} />
                      <span>{department.label}</span>
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="誰負責？">
                <div className="grid max-h-72 gap-2 overflow-auto rounded-lg border border-slate-200 bg-white p-3">
                  {orderedAssignmentUsers.map((item) => (
                    <label key={item.id} className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 text-base font-black text-slate-900">
                      <input className="h-5 w-5 min-h-0 p-0" name="ownerId" type="radio" required value={item.id} />
                      <span>{item.name}（{item.role.name} / {canonicalDepartmentName(item.department?.name)}）</span>
                    </label>
                  ))}
                </div>
              </Field>
              </div>
            </div>
            <Field label="任務名稱">
              <input name="title" required placeholder="例：仁武館冷氣維修追蹤" />
            </Field>
            <Field label="要完成什麼？">
              <textarea
                name="content"
                rows={4}
                required
                placeholder="例：請行政今天聯繫冷氣廠商，確認維修時間與報價，下午 5 點前回報。"
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="什麼時候完成？">
                <AndroidDateInput name="dueDate" required />
              </Field>
              <Field label="完成後怎麼回報？">
                <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 font-semibold">
                  <input name="requiresReport" type="checkbox" defaultChecked />
                  完成後請回報結果
                </label>
              </Field>
            </div>
            <Field label="加照片 / 檔案">
              <FileInputPreview name="attachments" note="可附照片、PDF 或文件。" />
            </Field>
            <details className="rounded-lg border border-slate-200 bg-slate-50">
              <summary className="cursor-pointer px-4 py-3 text-base font-black text-slate-900">進階設定</summary>
              <div className="grid gap-4 border-t border-slate-200 p-4">
                <Field label="急不急？">
                  <div className="grid grid-cols-2 gap-2">
                    {Object.values(TaskPriority).map((priority) => (
                      <label key={priority} className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 text-base font-black text-slate-900">
                        <input className="h-5 w-5 min-h-0 p-0" name="priority" type="radio" defaultChecked={priority === "MEDIUM"} value={priority} />
                        <span>{priorityLabels[priority]}</span>
                      </label>
                    ))}
                  </div>
                </Field>
                <p className="text-sm font-semibold leading-6 text-slate-600">交辦人：{user.name}。若未特別調整，系統會用一般優先級派發。</p>
              </div>
            </details>
            <details className="rounded-lg border border-slate-200 bg-slate-50">
              <summary className="cursor-pointer px-4 py-3 text-base font-black text-slate-900">填寫範例</summary>
              <div className="border-t border-slate-200 p-4 text-sm font-semibold leading-6 text-slate-600">
                例：請行政今天聯繫冷氣廠商，確認維修時間與報價，下午 5 點前回報。
              </div>
            </details>
            <div className="flex justify-end">
              <Button className="min-h-14 px-8 text-xl" type="submit">
                <ClipboardPlus className="h-5 w-5" />派發任務
              </Button>
            </div>
          </form>
        </details>
      ) : null}
    </>
  );
}
