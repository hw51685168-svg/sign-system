import { IssueSeverity, IssueType, Prisma, TaskPriority } from "@prisma/client";
import { Link2, MessageSquare, Send, Volume2 } from "lucide-react";
import { Button, Field, StatusBadge } from "@/components/ui";
import { VoicePlayer } from "@/components/voice-player";
import { VoiceRecorder } from "@/components/voice-recorder";
import { formatDateTime, issueSeverityLabels, issueStatusLabels, issueTypeLabels, safeText, serviceRequestStatusLabels, taskPriorityLabels, taskStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { scopedApprovalWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import {
  assertConversationAccess,
  canAttachVoiceToApproval,
  canConvertVoiceToIssue,
  canConvertVoiceToServiceRequest,
  canConvertVoiceToTask,
  formatSeconds,
  getConversationRecipients
} from "@/lib/voice";

export async function VoiceThread({ conversationId }: { conversationId: string }) {
  const user = await requireUser();
  const conversation = await assertConversationAccess(conversationId, user);
  if (!conversation) return null;

  const canTask = canConvertVoiceToTask(user);
  const canIssue = canConvertVoiceToIssue(user);
  const canService = canConvertVoiceToServiceRequest(user);
  const canApproval = canAttachVoiceToApproval(user);
  const voiceVisibilityClauses: Prisma.VoiceMessageWhereInput[] = [{ conversationId: conversation.id }];
  if (conversation.type === "TASK" && conversation.sourceId) voiceVisibilityClauses.push({ convertedTaskId: conversation.sourceId });
  if (conversation.type === "ISSUE" && conversation.sourceId) voiceVisibilityClauses.push({ convertedIssueId: conversation.sourceId });
  if (conversation.type === "SERVICE_REQUEST" && conversation.sourceId) voiceVisibilityClauses.push({ convertedServiceRequestId: conversation.sourceId });
  if (conversation.type === "APPROVAL" && conversation.sourceId) voiceVisibilityClauses.push({ attachedApprovalId: conversation.sourceId });

  const [voices, departments, users, stores, approvals] = await Promise.all([
    prisma.voiceMessage.findMany({
      where: {
        OR: voiceVisibilityClauses,
        isWithdrawn: false,
        message: { isDeleted: false }
      },
      include: {
        sender: { include: { department: true } },
        conversation: true,
        listens: { include: { user: true } },
        convertedTask: { select: { id: true, title: true, status: true } },
        convertedIssue: { select: { id: true, status: true } },
        convertedServiceRequest: { select: { id: true, requestNo: true, title: true, status: true } },
        attachedApproval: { select: { id: true, requestNo: true, subject: true, status: true } }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: canTask
        ? { isActive: true }
        : {
            isActive: true,
            OR: [
              { id: user.id },
              { departmentId: user.departmentId ?? "__NO_DEPARTMENT__" }
            ]
          },
      include: { department: true, role: true },
      orderBy: { name: "asc" }
    }),
    prisma.store.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.approvalRequest.findMany({
      where: scopedApprovalWhere(user),
      select: { id: true, requestNo: true, subject: true },
      orderBy: { updatedAt: "desc" },
      take: 30
    })
  ]);

  const currentApprovalId = conversation.type === "APPROVAL" ? conversation.sourceId : null;
  const listeningStateEntries = await Promise.all(
    voices.map(async (voice) => {
      const expectedIds = new Set<string>();
      const add = (id: string) => {
        if (id !== voice.senderId) expectedIds.add(id);
      };
      (await getConversationRecipients(voice.conversation, voice.senderId)).forEach(add);
      if (voice.conversationId !== conversation.id) {
        (await getConversationRecipients(conversation, voice.senderId)).forEach(add);
      }
      const expectedUsers = expectedIds.size
        ? await prisma.user.findMany({ where: { id: { in: Array.from(expectedIds) } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
        : [];
      const startedIds = new Set(voice.listens.map((listen) => listen.userId));
      const completedIds = new Set(voice.listens.filter((listen) => listen.completedAt).map((listen) => listen.userId));
      return [
        voice.id,
        {
          startedNames: voice.listens.map((listen) => listen.user.name),
          completedNames: voice.listens.filter((listen) => listen.completedAt).map((listen) => listen.user.name),
          pendingNames: expectedUsers.filter((item) => !startedIds.has(item.id)).map((item) => item.name),
          notCompletedNames: expectedUsers.filter((item) => !completedIds.has(item.id)).map((item) => item.name)
        }
      ] as const;
    })
  );
  const listeningStateMap = new Map(listeningStateEntries);

  return (
    <section id="voice-thread" className="grid gap-5 rounded-lg border border-brand-100 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-black text-brand-700">Voice Message（語音留言）</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">案件內語音溝通</h2>
          <p className="mt-2 text-base leading-7 text-slate-700">
            適合主管快速交代、門市補充現場狀況、部門留下處理重點。每則語音都會保留權限、通知與操作紀錄。
          </p>
        </div>
        <StatusBadge label={`${voices.length} 則語音`} tone={voices.length > 0 ? "blue" : "slate"} />
      </div>

      <VoiceRecorder conversationId={conversation.id} />

      <div className="grid gap-4">
        {voices.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-lg font-bold text-slate-900">尚無語音留言</p>
            <p className="mt-1 text-base text-slate-600">可先錄一段 120 秒內的語音，讓相關人員在同一案件中追蹤。</p>
          </div>
        ) : null}

        {voices.map((voice) => {
          const completedCount = voice.listens.filter((listen) => listen.completedAt).length;
          const canWithdraw = voice.senderId === user.id || user.roleKey === "GENERAL_MANAGER" || user.roleKey === "SYSTEM_ADMIN";
          const listeningState = listeningStateMap.get(voice.id);
          return (
            <article key={voice.id} id={`voice-${voice.id}`} className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-lg font-black text-slate-950">{voice.sender.name}</p>
                  <p className="text-sm font-semibold text-slate-600">
                    {safeText(voice.sender.department?.name, "未指定部門")} · {formatDateTime(voice.createdAt)} · {formatSeconds(voice.durationSeconds)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {voice.convertedTask ? <StatusBadge label={`已轉任務：${taskStatusLabels[voice.convertedTask.status]}`} tone="green" /> : null}
                  {voice.convertedIssue ? <StatusBadge label={`已轉問題：${issueStatusLabels[voice.convertedIssue.status]}`} tone="green" /> : null}
                  {voice.convertedServiceRequest ? <StatusBadge label={`已轉服務：${serviceRequestStatusLabels[voice.convertedServiceRequest.status]}`} tone="green" /> : null}
                  {voice.attachedApproval ? <StatusBadge label="已加入簽呈" tone="purple" /> : null}
                </div>
              </div>

              <VoicePlayer voiceMessageId={voice.id} streamUrl={`/api/chat/voice/${voice.id}/stream`} durationSeconds={voice.durationSeconds} />

              {voice.manualSummary ? (
                <div className="rounded-md bg-white p-3 text-base leading-7 text-slate-800">
                  <p className="mb-1 font-bold text-slate-950">語音重點</p>
                  <p className="whitespace-pre-wrap">{voice.manualSummary}</p>
                </div>
              ) : null}

              <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                <p>已開始聆聽：{voice.listens.length} 人</p>
                <p>完整聽完：{completedCount} 人</p>
              </div>
              <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 md:grid-cols-2">
                <div>
                  <p className="font-black text-slate-950">已聽名單</p>
                  <p>{listeningState?.startedNames.length ? listeningState.startedNames.join("、") : "尚無人開始播放"}</p>
                </div>
                <div>
                  <p className="font-black text-slate-950">未聽名單</p>
                  <p>{listeningState?.pendingNames.length ? listeningState.pendingNames.join("、") : "目前無未聽名單"}</p>
                </div>
                <div>
                  <p className="font-black text-slate-950">完整聽完</p>
                  <p>{listeningState?.completedNames.length ? listeningState.completedNames.join("、") : "尚無人完整聽完"}</p>
                </div>
                <div>
                  <p className="font-black text-slate-950">尚未完整聽完</p>
                  <p>{listeningState?.notCompletedNames.length ? listeningState.notCompletedNames.join("、") : "目前無待完整聆聽名單"}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {voice.convertedTask ? (
                  <a className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 hover:bg-slate-50" href={`/tasks/${voice.convertedTask.id}`}>
                    <Link2 className="h-4 w-4" />
                    查看任務
                  </a>
                ) : null}
                {voice.convertedIssue ? (
                  <a className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 hover:bg-slate-50" href={`/issues/${voice.convertedIssue.id}`}>
                    <Link2 className="h-4 w-4" />
                    查看問題回報
                  </a>
                ) : null}
                {voice.convertedServiceRequest ? (
                  <a className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 hover:bg-slate-50" href={`/services/requests/${voice.convertedServiceRequest.id}`}>
                    <Link2 className="h-4 w-4" />
                    查看服務需求
                  </a>
                ) : null}
                {voice.attachedApproval ? (
                  <a className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 hover:bg-slate-50" href={`/approvals/${voice.attachedApproval.id}#voice-${voice.id}`}>
                    <Link2 className="h-4 w-4" />
                    查看簽呈
                  </a>
                ) : null}
              </div>

              <details className="rounded-md border border-slate-200 bg-white p-3">
                <summary className="cursor-pointer text-base font-black text-slate-900">語音閉環操作</summary>
                <div className="mt-4 grid gap-4">
                  {canTask && !voice.convertedTask ? (
                    <form action={`/api/chat/voice/${voice.id}/convert-to-task`} method="post" className="grid gap-3 rounded-md border border-slate-200 p-3">
                      <h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><Send className="h-5 w-5" />轉成任務</h3>
                      <Field label="任務名稱"><input name="title" defaultValue={`語音任務：${voice.manualSummary ?? voice.fileName}`} required /></Field>
                      <Field label="負責人">
                        <select name="ownerId" defaultValue={user.id}>
                          {users.map((item) => <option key={item.id} value={item.id}>{item.name}（{item.role.name}）</option>)}
                        </select>
                      </Field>
                      <Field label="負責部門">
                        <select name="departmentId" defaultValue={user.departmentId ?? ""}>
                          <option value="">未指定</option>
                          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                        </select>
                      </Field>
                      <Field label="截止日期"><input name="dueDate" type="date" /></Field>
                      <Field label="優先程度">
                        <select name="priority" defaultValue={TaskPriority.MEDIUM}>
                          {Object.values(TaskPriority).map((priority) => <option key={priority} value={priority}>{taskPriorityLabels[priority]}</option>)}
                        </select>
                      </Field>
                      <Button type="submit">建立任務</Button>
                    </form>
                  ) : null}

                  {canIssue && !voice.convertedIssue ? (
                    <form action={`/api/chat/voice/${voice.id}/convert-to-issue`} method="post" className="grid gap-3 rounded-md border border-slate-200 p-3">
                      <h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><MessageSquare className="h-5 w-5" />轉成問題回報</h3>
                      <Field label="問題標題 / 補充說明"><input name="title" defaultValue={voice.manualSummary ?? ""} /></Field>
                      <Field label="問題類型">
                        <select name="type" defaultValue={IssueType.OTHER}>
                          {Object.values(IssueType).map((type) => <option key={type} value={type}>{issueTypeLabels[type]}</option>)}
                        </select>
                      </Field>
                      <Field label="嚴重程度">
                        <select name="severity" defaultValue={IssueSeverity.MEDIUM}>
                          {Object.values(IssueSeverity).map((severity) => <option key={severity} value={severity}>{issueSeverityLabels[severity]}</option>)}
                        </select>
                      </Field>
                      <Field label="門市">
                        <select name="storeId" defaultValue={user.storeId ?? ""}>
                          <option value="">未指定</option>
                          {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
                        </select>
                      </Field>
                      <Field label="指派處理部門">
                        <select name="assignedDepartmentId" defaultValue={user.departmentId ?? ""}>
                          <option value="">未指定</option>
                          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                        </select>
                      </Field>
                      <Button type="submit">建立問題回報</Button>
                    </form>
                  ) : null}

                  {canService && !voice.convertedServiceRequest ? (
                    <form action={`/api/chat/voice/${voice.id}/convert-to-service-request`} method="post" className="grid gap-3 rounded-md border border-slate-200 p-3">
                      <h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><Volume2 className="h-5 w-5" />轉成服務需求</h3>
                      <Field label="需求名稱"><input name="title" defaultValue={`語音服務需求：${voice.manualSummary ?? voice.fileName}`} required /></Field>
                      <Field label="服務分類"><input name="category" defaultValue="語音服務需求" /></Field>
                      <Field label="服務項目"><input name="serviceName" defaultValue="語音留言轉單" /></Field>
                      <Field label="負責部門">
                        <select name="responsibleDepartmentId" defaultValue={user.departmentId ?? ""} required>
                          <option value="">請選擇</option>
                          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                        </select>
                      </Field>
                      <Field label="主責人">
                        <select name="ownerId" defaultValue="">
                          <option value="">先不指定</option>
                          {users.map((item) => <option key={item.id} value={item.id}>{item.name}（{item.role.name}）</option>)}
                        </select>
                      </Field>
                      <Field label="截止日期"><input name="dueDate" type="date" /></Field>
                      <Field label="優先程度">
                        <select name="priority" defaultValue={TaskPriority.MEDIUM}>
                          {Object.values(TaskPriority).map((priority) => <option key={priority} value={priority}>{taskPriorityLabels[priority]}</option>)}
                        </select>
                      </Field>
                      <Button type="submit">建立服務需求</Button>
                    </form>
                  ) : null}

                  {canApproval && !voice.attachedApproval ? (
                    <form action={`/api/chat/voice/${voice.id}/attach-to-approval`} method="post" className="grid gap-3 rounded-md border border-slate-200 p-3">
                      <h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><Link2 className="h-5 w-5" />加入簽呈補充</h3>
                      {currentApprovalId ? <input name="approvalId" type="hidden" value={currentApprovalId} /> : (
                        <Field label="選擇簽呈">
                          <select name="approvalId" required>
                            <option value="">請選擇</option>
                            {approvals.map((approval) => (
                              <option key={approval.id} value={approval.id}>{approval.requestNo}：{approval.subject}</option>
                            ))}
                          </select>
                        </Field>
                      )}
                      <Button type="submit" variant="secondary">加入簽呈紀錄</Button>
                    </form>
                  ) : null}

                  {canWithdraw ? (
                    <form action={`/api/chat/voice/${voice.id}/withdraw`} method="post" className="flex justify-end">
                      <Button type="submit" variant="danger">撤回語音</Button>
                    </form>
                  ) : null}
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
