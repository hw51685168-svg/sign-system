import { notFound } from "next/navigation";
import { Archive, Check, MessageSquare, Play, RotateCcw, Send } from "lucide-react";
import { Button, Field, LinkButton, PageHeader, Panel, StatusBadge, statusTone } from "@/components/ui";
import { VoiceThread } from "@/components/voice-thread";
import { formatDate, formatDateTime, safeText, serviceRequestStatusLabels, taskPriorityLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { canViewAllBusinessData, isBranchManager, isDepartmentManager, scopedServiceRequestWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { getOrCreateConversation } from "@/lib/voice";

export default async function ServiceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await requireUser();
  const request = await prisma.serviceRequest.findFirst({
    where: { AND: [{ id: resolvedParams.id }, scopedServiceRequestWhere(user)] },
    include: {
      requester: true,
      requesterDepartment: true,
      responsibleDepartment: true,
      owner: true,
      attachments: true,
      logs: { include: { actor: true }, orderBy: { createdAt: "desc" } }
    }
  });
  if (!request) notFound();
  const canProcess =
    canViewAllBusinessData(user) ||
    request.ownerId === user.id ||
    (isDepartmentManager(user.roleKey) && request.responsibleDepartmentId === user.departmentId) ||
    (isBranchManager(user.roleKey) && request.storeId === user.storeId);
  const canConfirm =
    canViewAllBusinessData(user) ||
    request.requesterId === user.id ||
    (isDepartmentManager(user.roleKey) && request.requesterDepartmentId === user.departmentId);
  const conversation = await getOrCreateConversation({
    type: "SERVICE_REQUEST",
    sourceType: "service_request",
    sourceId: request.id,
    title: `服務需求：${request.title}`,
    departmentId: request.responsibleDepartmentId ?? request.requesterDepartmentId,
    storeId: request.storeId,
    createdById: user.id
  });

  return (
    <>
      <PageHeader
        title={safeText(request.title, "未命名服務需求")}
        description={`${request.requestNo} · ${request.category} / ${request.serviceName}`}
        actions={<LinkButton href="/services" variant="secondary">返回服務目錄</LinkButton>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-6">
          <Panel>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={serviceRequestStatusLabels[request.status]} tone={statusTone(request.status)} />
              <StatusBadge label={taskPriorityLabels[request.priority]} />
            </div>
            <dl className="mt-5 grid gap-4 text-base md:grid-cols-2">
              <div><dt className="font-bold text-slate-700">發起部門</dt><dd>{safeText(request.requesterDepartment?.name, "未指定")}</dd></div>
              <div><dt className="font-bold text-slate-700">承接部門</dt><dd>{safeText(request.responsibleDepartment?.name, "未指定")}</dd></div>
              <div><dt className="font-bold text-slate-700">發起人</dt><dd>{request.requester.name}</dd></div>
              <div><dt className="font-bold text-slate-700">承辦人</dt><dd>{safeText(request.owner?.name, "未指定")}</dd></div>
              <div><dt className="font-bold text-slate-700">期限</dt><dd>{formatDate(request.dueDate)}</dd></div>
              <div><dt className="font-bold text-slate-700">建立時間</dt><dd>{formatDateTime(request.createdAt)}</dd></div>
            </dl>
            <div className="mt-6 rounded-lg bg-slate-50 p-4 text-lg leading-8 text-slate-800 whitespace-pre-wrap">{safeText(request.content, "尚無內容")}</div>
          </Panel>
          <VoiceThread conversationId={conversation.id} />
        </div>
        <div className="grid gap-6">
          <Panel>
            <h2 className="mb-4 text-xl font-black text-slate-950">處理動作</h2>
            <form action={`/api/services/requests/${request.id}/actions`} method="post" className="grid gap-4">
              <Field label="留言 / 退回原因">
                <textarea name="comment" placeholder="需要補充說明、退回修改或結案備註時請填寫。" />
              </Field>
              <div className="grid gap-2">
                {canProcess && request.status === "SUBMITTED" ? (
                  <Button name="action" value="ACCEPT" type="submit">
                    <Check className="h-4 w-4" />
                    接單
                  </Button>
                ) : null}
                {canProcess && ["SUBMITTED", "ACCEPTED"].includes(request.status) ? (
                  <Button name="action" value="START" type="submit" variant="secondary">
                    <Play className="h-4 w-4" />
                    開始處理
                  </Button>
                ) : null}
                {canProcess && ["ACCEPTED", "IN_PROGRESS"].includes(request.status) ? (
                  <Button name="action" value="SUBMIT_COMPLETE" type="submit" variant="secondary">
                    <Send className="h-4 w-4" />
                    送完成確認
                  </Button>
                ) : null}
                {canConfirm && request.status === "WAITING_CONFIRMATION" ? (
                  <>
                    <Button name="action" value="CONFIRM_COMPLETE" type="submit">
                      <Check className="h-4 w-4" />
                      確認完成
                    </Button>
                    <Button name="action" value="REJECT_REVISION" type="submit" variant="danger">
                      <RotateCcw className="h-4 w-4" />
                      退回修改
                    </Button>
                  </>
                ) : null}
                {canConfirm && request.status === "COMPLETED" ? (
                  <Button name="action" value="CLOSE" type="submit">
                    <Archive className="h-4 w-4" />
                    結案
                  </Button>
                ) : null}
                <Button name="action" value="COMMENT" type="submit" variant="secondary">
                  <MessageSquare className="h-4 w-4" />
                  留言
                </Button>
              </div>
            </form>
          </Panel>
          <Panel>
            <h2 className="mb-4 text-xl font-black text-slate-950">附件</h2>
            {request.attachments.length === 0 ? <p className="text-slate-700">尚未上傳附件。</p> : null}
            <div className="grid gap-2">
              {request.attachments.map((attachment) => (
                <a key={attachment.id} href={attachment.fileUrl} target="_blank" className="rounded-md border border-slate-200 px-3 py-2 text-brand-700 hover:bg-slate-50">
                  {attachment.fileName}
                </a>
              ))}
            </div>
          </Panel>
          <Panel>
            <h2 className="mb-4 text-xl font-black text-slate-950">歷程紀錄</h2>
            <div className="grid gap-3">
              {request.logs.map((log) => (
                <div key={log.id} className="rounded-md border border-slate-200 p-3">
                  <p className="font-bold text-slate-950">{log.action} · {log.actor.name}</p>
                  <p className="text-sm text-slate-600">{formatDateTime(log.createdAt)}</p>
                  {log.comment ? <p className="mt-2 text-base text-slate-700">{log.comment}</p> : null}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
