import { notFound } from "next/navigation";
import { Check, Paperclip, Play, RotateCcw, Save, X } from "lucide-react";
import { Button, Field, LinkButton, PageHeader, Panel, StatusBadge, statusTone } from "@/components/ui";
import { VoiceThread } from "@/components/voice-thread";
import { formatDate, formatDateTime, safeText, taskPriorityLabels, taskStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { canApprove, scopedTaskWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { getOrCreateConversation } from "@/lib/voice";

function primaryAction(status: string, canReview: boolean) {
  if (status === "NOT_STARTED") return [{ label: "開始處理", value: "IN_PROGRESS", icon: Play, variant: "primary" as const }];
  if (status === "IN_PROGRESS") {
    return [
      { label: "送出完成", value: "WAITING_CONFIRMATION", icon: Check, variant: "primary" as const },
      { label: "新增回報", value: "IN_PROGRESS", icon: Save, variant: "secondary" as const }
    ];
  }
  if (status === "WAITING_CONFIRMATION" && canReview) {
    return [
      { label: "通過", value: "COMPLETED", icon: Check, variant: "primary" as const },
      { label: "駁回", value: "REJECTED", icon: X, variant: "danger" as const },
      { label: "退回修改", value: "REJECTED", icon: RotateCcw, variant: "secondary" as const }
    ];
  }
  if (status === "REJECTED") return [{ label: "修改後重新送出", value: "WAITING_CONFIRMATION", icon: RotateCcw, variant: "primary" as const }];
  if (status === "COMPLETED") return [{ label: "查看紀錄", value: "COMPLETED", icon: Check, variant: "secondary" as const }];
  return [{ label: "更新任務", value: status, icon: Save, variant: "primary" as const }];
}

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const task = await prisma.task.findFirst({
    where: { AND: [{ id: params.id }, scopedTaskWhere(user)] },
    include: {
      owner: true,
      creator: true,
      department: true,
      assistants: { include: { user: true } },
      comments: { include: { author: true }, orderBy: { createdAt: "desc" } },
      attachments: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!task) notFound();

  const canReview = canApprove(user);
  const actions = primaryAction(task.status, canReview);
  const progress = Math.min(Math.max(task.progress, 0), 100);
  const conversation = await getOrCreateConversation({
    type: "TASK",
    sourceType: "task",
    sourceId: task.id,
    title: `任務：${task.title}`,
    departmentId: task.departmentId,
    storeId: task.storeId,
    createdById: user.id
  });

  return (
    <>
      <PageHeader
        title={safeText(task.title, "未命名任務")}
        description={`負責人：${safeText(task.owner.name, "未指定")} · 截止：${formatDate(task.dueDate)} · 最近更新：${formatDateTime(task.updatedAt)}`}
        actions={<LinkButton href="/tasks" variant="secondary">返回任務列表</LinkButton>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="grid gap-6">
          <Panel>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">任務摘要</h2>
                <p className="mt-3 whitespace-pre-wrap text-lg leading-8 text-slate-800">{safeText(task.content, "尚無內容")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge label={taskPriorityLabels[task.priority]} />
                <StatusBadge label={taskStatusLabels[task.status]} tone={statusTone(task.status)} />
              </div>
            </div>
            <dl className="mt-6 grid gap-4 text-base md:grid-cols-2">
              <div><dt className="font-bold text-slate-700">建立者</dt><dd>{safeText(task.creator.name, "未指定")}</dd></div>
              <div><dt className="font-bold text-slate-700">所屬部門</dt><dd>{safeText(task.department?.name, "未指定")}</dd></div>
              <div><dt className="font-bold text-slate-700">協助人</dt><dd>{task.assistants.map((item) => item.user.name).join("、") || "未指定"}</dd></div>
              <div><dt className="font-bold text-slate-700">建立時間</dt><dd>{formatDateTime(task.createdAt)}</dd></div>
            </dl>
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-base font-bold text-slate-800">
                <span>目前進度</span>
                <span>{progress}%</span>
              </div>
              <div className="h-4 rounded-full bg-slate-100">
                <div className="h-4 rounded-full bg-brand-700" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </Panel>

          <Panel>
            <h2 className="mb-4 text-2xl font-black text-slate-950">留言與歷程紀錄</h2>
            {task.comments.length === 0 ? (
              <p className="text-slate-700">尚無內容</p>
            ) : (
              <div className="grid gap-3">
                {task.comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-slate-950">{comment.author.name}</p>
                      <p className="text-sm text-slate-600">{formatDateTime(comment.createdAt)}</p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-800">{safeText(comment.content, "尚無內容")}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <VoiceThread conversationId={conversation.id} />

          <Panel>
            <h2 className="mb-4 text-2xl font-black text-slate-950">附件</h2>
            {task.attachments.length === 0 ? (
              <p className="text-slate-700">尚未上傳附件。</p>
            ) : (
              <div className="grid gap-2">
                {task.attachments.map((attachment) => (
                  <a key={attachment.id} className="rounded-md border border-slate-200 px-3 py-2 text-brand-700 hover:bg-slate-50" href={attachment.fileUrl} target="_blank">
                    <Paperclip className="mr-2 inline h-4 w-4" />
                    {safeText(attachment.fileName, "附件")}
                  </a>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <Panel className="h-fit xl:sticky xl:top-24">
          <h2 className="mb-4 text-2xl font-black text-slate-950">任務操作</h2>
          <form action={`/api/tasks/${task.id}/status`} method="post" encType="multipart/form-data" className="grid gap-4">
            <Field label="狀態">
              <select name="status" defaultValue={task.status}>
                {Object.entries(taskStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="進度" hint="只能輸入 0 到 100，系統會自動顯示百分比。">
              <div className="grid gap-2">
                <input name="progress" type="range" min="0" max="100" defaultValue={progress} />
                <input name="progressNumber" type="number" inputMode="numeric" min="0" max="100" defaultValue={progress} />
              </div>
            </Field>
            <Field label="處理回報 / 駁回原因">
              <textarea name="reportContent" placeholder="請輸入本次處理狀況、主管意見或退回原因。" defaultValue={task.reportContent ?? ""} />
            </Field>
            <Field label="上傳附件">
              <input name="attachments" type="file" multiple />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button key={action.label} name="quickStatus" value={action.value} type="submit" variant={action.variant}>
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </Button>
                );
              })}
              <Button className="sm:col-span-2" type="submit" variant="secondary">
                <Save className="h-4 w-4" />
                送出更新
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}
