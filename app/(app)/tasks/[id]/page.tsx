import { notFound } from "next/navigation";
import { Check, Paperclip, Play, RotateCcw, Save, Send, X } from "lucide-react";
import { Button, Field, LinkButton, PageHeader, Panel, StatusBadge, statusTone } from "@/components/ui";
import { VoiceThread } from "@/components/voice-thread";
import { canWriteTaskCommunication } from "@/lib/communication-permissions";
import { formatDate, formatDateTime, safeText, taskPriorityLabels, taskStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { canManageSystem, scopedTaskWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { getOrCreateConversation } from "@/lib/voice";

type ActionFlags = {
  canOwnerAction: boolean;
  canCreatorAction: boolean;
};

function taskActions(status: string, flags: ActionFlags) {
  const cancelAction = flags.canCreatorAction && !["COMPLETED", "CANCELLED", "WAITING_CONFIRMATION"].includes(status)
    ? [{ label: "取消任務", value: "CANCELLED", icon: X, variant: "danger" as const }]
    : [];

  if (status === "NOT_STARTED") {
    const ownerActions = flags.canOwnerAction ? [{ label: "開始處理", value: "IN_PROGRESS", icon: Play, variant: "primary" as const }] : [];
    return [...ownerActions, ...cancelAction];
  }

  if (status === "IN_PROGRESS") {
    const ownerActions = flags.canOwnerAction ? [
      { label: "送出完成", value: "WAITING_CONFIRMATION", icon: Check, variant: "primary" as const },
      { label: "回報處理中", value: "IN_PROGRESS", icon: Save, variant: "secondary" as const }
    ] : [];
    return [...ownerActions, ...cancelAction];
  }

  if (status === "WAITING_CONFIRMATION") {
    return flags.canCreatorAction ? [
      { label: "確認完成", value: "COMPLETED", icon: Check, variant: "primary" as const },
      { label: "退回補充", value: "REJECTED", icon: X, variant: "danger" as const },
      { label: "要求補充說明", value: "REJECTED", icon: RotateCcw, variant: "secondary" as const }
    ] : [];
  }

  if (status === "REJECTED") {
    const ownerActions = flags.canOwnerAction ? [{ label: "重新送出確認", value: "WAITING_CONFIRMATION", icon: RotateCcw, variant: "primary" as const }] : [];
    return [...ownerActions, ...cancelAction];
  }

  return [];
}

function statusGuidance(status: string, isOwner: boolean, isCreator: boolean, canOverride: boolean) {
  if (canOverride) return "你可以協助處理特殊狀態，但系統會留下操作紀錄。";
  if (status === "NOT_STARTED") return isOwner ? "請由承辦人開始處理。" : "等待承辦人開始處理。";
  if (status === "IN_PROGRESS") return isOwner ? "請由承辦人回報進度或送出完成。" : "承辦人處理中，交辦人可查看進度與留言。";
  if (status === "WAITING_CONFIRMATION") return isCreator ? "承辦人已回報完成，請交辦人確認結案或退回補充。" : "已送交辦人確認，請等待結案或退回。";
  if (status === "REJECTED") return isOwner ? "交辦人已退回補充，請承辦人補充後重新送出確認。" : "已退回承辦人補充。";
  if (status === "COMPLETED") return "任務已結案，只能查看紀錄。";
  if (status === "CANCELLED") return "任務已取消，只能查看紀錄。";
  if (status === "OVERDUE") return "任務已逾期，請依目前責任角色處理。";
  return "請依任務狀態處理。";
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await requireUser();
  const task = await prisma.task.findFirst({
    where: { AND: [{ id: resolvedParams.id }, scopedTaskWhere(user)] },
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

  const isOwner = task.ownerId === user.id;
  const isCreator = task.creatorId === user.id;
  const canOverride = user.roleKey === "GENERAL_MANAGER" || canManageSystem(user);
  const actions = taskActions(task.status, {
    canOwnerAction: isOwner || canOverride,
    canCreatorAction: isCreator || canOverride
  });
  const guidance = statusGuidance(task.status, isOwner, isCreator, canOverride);
  const canWriteCommunication = canWriteTaskCommunication(user, task);
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
        title={safeText(task.title, "任務詳情")}
        description={`負責人：${safeText(task.owner.name, "未指定")} ｜ 截止：${formatDate(task.dueDate)} ｜ 最後更新：${formatDateTime(task.updatedAt)}`}
        actions={<LinkButton href="/tasks" variant="secondary">返回任務列表</LinkButton>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="grid gap-6">
          <Panel>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">任務內容</h2>
                <p className="mt-3 whitespace-pre-wrap text-lg leading-8 text-slate-800">{safeText(task.content, "尚未填寫內容")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge label={taskPriorityLabels[task.priority]} />
                <StatusBadge label={taskStatusLabels[task.status]} tone={statusTone(task.status)} />
              </div>
            </div>
            <dl className="mt-6 grid gap-4 text-base md:grid-cols-2">
              <div><dt className="font-bold text-slate-700">建立人</dt><dd>{safeText(task.creator.name, "未指定")}</dd></div>
              <div><dt className="font-bold text-slate-700">接收部門</dt><dd>{safeText(task.department?.name, "未指定")}</dd></div>
              <div><dt className="font-bold text-slate-700">協助人員</dt><dd>{task.assistants.map((item) => item.user.name).join("、") || "未指定"}</dd></div>
              <div><dt className="font-bold text-slate-700">建立時間</dt><dd>{formatDateTime(task.createdAt)}</dd></div>
            </dl>
          </Panel>

          <Panel>
            <h2 className="mb-4 text-2xl font-black text-slate-950">回報與留言</h2>
            {canWriteCommunication ? (
              <form action={`/api/tasks/${task.id}/comments`} method="post" className="mb-5 grid gap-3 rounded-lg border border-brand-100 bg-brand-50 p-4">
                <Field label="文字回報" hint="可記錄處理狀況、需要協助的地方，或補充給發派人與相關部門看的說明。">
                  <textarea name="content" required rows={4} maxLength={1000} placeholder="請輸入回報內容，例如：已完成現場確認，等待主管確認。" />
                </Field>
                <div className="flex justify-end">
                  <Button type="submit">
                    <Send className="h-4 w-4" />
                    送出留言
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-base font-semibold leading-7 text-slate-700">
                ???????????????????????
              </div>
            )}
            {task.comments.length === 0 ? (
              <p className="text-slate-700">尚無回報紀錄</p>
            ) : (
              <div className="grid gap-3">
                {task.comments.map((comment) => (
                  <div id={`comment-${comment.id}`} key={comment.id} className="scroll-mt-24 rounded-lg border border-slate-200 bg-slate-50 p-4">
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

          <div id="voice-thread" className="scroll-mt-24">
            <VoiceThread conversationId={conversation.id} readOnly={!canWriteCommunication} />
          </div>

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
          <h2 className="mb-4 text-2xl font-black text-slate-950">任務狀態</h2>
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-500">目前狀態</p>
            <div className="mt-2">
              <StatusBadge label={taskStatusLabels[task.status]} tone={statusTone(task.status)} />
            </div>
            <p className="mt-3 text-base font-semibold leading-7 text-slate-700">{guidance}</p>
          </div>
          {actions.length > 0 ? (
            <form action={`/api/tasks/${task.id}/status`} method="post" encType="multipart/form-data" className="grid gap-4">
              <Field label="處理回報 / 退回原因">
                <textarea name="reportContent" placeholder="請輸入目前處理狀況、完成說明，或退回時需要補充的原因。" defaultValue={task.reportContent ?? ""} />
              </Field>
              <Field label="新增附件">
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
              </div>
            </form>
          ) : null}
        </Panel>
      </div>
    </>
  );
}
