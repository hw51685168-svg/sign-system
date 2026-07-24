import { notFound } from "next/navigation";
import { Download, MessageSquare } from "lucide-react";
import { Button, Field, LinkButton, PageHeader, Panel, StatusBadge, statusTone, TimelineIcon } from "@/components/ui";
import { ApprovalActionPanel } from "@/components/approval-action-panel";
import { AttachmentPreviewList } from "@/components/attachment-preview-list";
import { SignaturePad } from "@/components/signature-pad";
import { VoiceThread } from "@/components/voice-thread";
import { approvalStageLabel, canUseApprovalAction, parseApprovalDescription } from "@/lib/approval-lite";
import { canWriteApprovalCommunication } from "@/lib/communication-permissions";
import { approvalActionLabels, approvalStatusLabels, approvalTypeLabels, formatAmount, formatDateTime, safeText } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { scopedApprovalWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { demoApprovals, demoMode } from "@/lib/demo";
import { getOrCreateConversation } from "@/lib/voice";

function actionResultMessage(value?: string) {
  const messages: Record<string, { title: string; body: string }> = {
    approved: { title: "已核准", body: "簽呈已送往下一關，系統已通知下一位處理人。" },
    "approved-final": { title: "已完成核准", body: "簽呈已完成全部簽核流程。" },
    rejected: { title: "已駁回", body: "駁回原因已記錄，申請人可在簽核紀錄中查看。" },
    revision: { title: "已退回修改", body: "退回修改原因已記錄，申請人可補充後重新送出。" },
    comment: { title: "留言已送出", body: "內部留言已保存。" },
    updated: { title: "已更新", body: "簽呈資料已更新。" }
  };
  return value ? messages[value] : null;
}

function approvalModeLabel(mode: string) {
  if (mode === "CHECKBOX") return "打勾式簽核";
  if (mode === "HANDWRITTEN") return "電子手寫簽名";
  return "打勾確認 + 電子手寫簽名";
}

function emptyText(value?: string | null) {
  return safeText(value, "未填寫");
}

function userUnitLabel(user?: { department?: { name: string } | null; store?: { name: string } | null; role?: { name: string } | null } | null) {
  return safeText(user?.department?.name ?? user?.store?.name ?? user?.role?.name, "未指定單位");
}

function userNameWithUnit(user?: { name?: string | null; department?: { name: string } | null; store?: { name: string } | null; role?: { name: string } | null } | null) {
  return `${safeText(user?.name, "未指定簽核人")}（${userUnitLabel(user)}）`;
}

function stepStatusLabel(step: { isCompleted: boolean; completedAt?: Date | null }, isCurrent: boolean, approvalStatus: string) {
  if (step.isCompleted) return "已完成簽核";
  if (["REJECTED", "CLOSED", "APPROVED"].includes(approvalStatus)) return "未簽核";
  return isCurrent ? "等待簽核" : "尚未輪到";
}

function isTerminalStatus(status: string) {
  return ["APPROVED", "REJECTED", "CLOSED"].includes(status);
}

export default async function ApprovalDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ created?: string; actionResult?: string; actionError?: string; signature?: string }>;
}) {
  const resolvedParams = await params;
  const parsedSearchParams = (await searchParams) ?? {};
  const user = await requireUser();

  if (demoMode) {
    const demoApproval = demoApprovals.find((item) => item.id === resolvedParams.id) ?? demoApprovals[0];
    return (
      <>
        <PageHeader
          title={demoApproval.subject}
          description={`${demoApproval.requestNo} · ${approvalTypeLabels[demoApproval.type as keyof typeof approvalTypeLabels]} · ${demoApproval.applicant.name}`}
          actions={<StatusBadge label={approvalStatusLabels[demoApproval.status as keyof typeof approvalStatusLabels]} tone={statusTone(demoApproval.status)} />}
        />
        <Panel>
          <h2 className="mb-3 text-2xl font-black text-slate-950">簽呈內容</h2>
          <p className="whitespace-pre-wrap text-lg font-semibold leading-8 text-slate-700">{demoApproval.description}</p>
        </Panel>
      </>
    );
  }

  const approval = await prisma.approvalRequest.findFirst({
    where: { AND: [{ id: resolvedParams.id }, scopedApprovalWhere(user)] },
    include: {
      applicant: true,
      department: true,
      store: true,
      steps: { include: { approver: { include: { department: true, store: true, role: true } } }, orderBy: { stepOrder: "asc" } },
      logs: { include: { actor: { include: { department: true, store: true, role: true } } }, orderBy: { createdAt: "desc" } },
      signatures: { include: { signer: true }, orderBy: { signedAt: "desc" } },
      attachments: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!approval) notFound();

  const conversation = await getOrCreateConversation({
    type: "APPROVAL",
    sourceType: "approval",
    sourceId: approval.id,
    title: `簽呈：${approval.subject}`,
    departmentId: approval.departmentId,
    storeId: approval.storeId,
    createdById: approval.applicantId
  });

  const latestAttentionLog = approval.logs.find((log) => ["REJECT", "REQUEST_REVISION"].includes(log.action) && log.comment);
  const sections = parseApprovalDescription(approval.description);
  const unitName = approval.store?.name ?? approval.department?.name;
  const isApplicant = approval.applicantId === user.id;
  const canAct = !isApplicant && canUseApprovalAction(user, approval);
  const currentStep = approval.steps.find((step) => !step.isCompleted);
  const applicantSignatures = approval.signatures.filter((signature) => signature.signaturePurpose === "APPLICANT");
  const approverSignatures = approval.signatures.filter((signature) => signature.signaturePurpose === "APPROVER");
  const hasCurrentUserSignature = approverSignatures.some((signature) => signature.signerId === user.id);
  const requiresSignatureBeforeApprove = canAct && approval.approvalMode !== "CHECKBOX";
  const resultMessage = actionResultMessage(parsedSearchParams?.actionResult);
  const terminal = isTerminalStatus(approval.status);
  const canWriteCommunication = canWriteApprovalCommunication(user, approval);
  const flowLine = [
    `申請人：${approval.applicant.name}（${emptyText(unitName)}）`,
    ...approval.steps.map((step) => `第 ${step.stepOrder} 關：${step.title} / ${userNameWithUnit(step.approver)}`)
  ].join(" → ");
  const currentLocationText =
    approval.status === "APPROVED" || approval.status === "CLOSED"
      ? "已完成全部簽核流程"
      : approval.status === "REJECTED"
        ? "已駁回，等待申請人查看原因或重新提出"
        : approval.status === "NEEDS_REVISION"
          ? "已退回修改，等待申請人補件後重新送出"
          : currentStep
            ? `等待 ${currentStep.title}：${userNameWithUnit(currentStep.approver)}`
            : "尚未建立簽核流程";
  const nextActionText =
    canAct && currentStep
      ? "你就是目前處理人，請確認內容、附件與簽名後，再選擇核准、駁回或退回修改。"
      : currentStep
        ? `目前等待 ${safeText(currentStep.approver?.name, "簽核人")} 處理，完成後系統會通知下一位或通知申請人。`
        : approval.status === "APPROVED" || approval.status === "CLOSED"
          ? "簽呈已完成，可預覽 PDF、查看簽核紀錄或依公司流程交由承辦單位處理。"
          : approval.status === "REJECTED"
            ? "請查看駁回原因，必要時由申請人重新提出。"
            : approval.status === "NEEDS_REVISION"
              ? "請查看退回修改說明，補件後重新送出。"
              : "請確認此簽呈是否已建立完整簽核流程。";

  return (
    <>
      <PageHeader
        title={approval.subject}
        description={`${approval.requestNo} · ${approvalTypeLabels[approval.type]} · ${approval.applicant.name}`}
        actions={
          <>
            <LinkButton href="/approvals/progress" variant="secondary">返回簽呈進度</LinkButton>
            <LinkButton href={`/approvals/${approval.id}/pdf`} variant="secondary" target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
              預覽 / 下載 PDF
            </LinkButton>
            <StatusBadge label={approvalStageLabel(approval)} tone={statusTone(approval.status)} />
          </>
        }
      />

      {parsedSearchParams?.created === "1" ? (
        <Panel className="mb-5 border-emerald-200 bg-emerald-50">
          <p className="text-2xl font-black text-emerald-950">簽呈已送出</p>
          <p className="mt-2 text-lg font-semibold text-emerald-800">系統已建立簽核流程，並通知第一關簽核人。</p>
        </Panel>
      ) : null}

      {resultMessage ? (
        <Panel className="mb-5 border-emerald-200 bg-emerald-50">
          <p className="text-2xl font-black text-emerald-950">{resultMessage.title}</p>
          <p className="mt-2 text-lg font-semibold text-emerald-800">{resultMessage.body}</p>
        </Panel>
      ) : null}

      {parsedSearchParams?.actionError ? (
        <Panel className="mb-5 border-red-200 bg-red-50">
          <p className="text-2xl font-black text-red-950">操作未完成</p>
          <p className="mt-2 text-lg font-semibold text-red-800">{parsedSearchParams.actionError}</p>
        </Panel>
      ) : null}

      {parsedSearchParams?.signature === "1" ? (
        <Panel className="mb-5 border-emerald-200 bg-emerald-50">
          <p className="text-2xl font-black text-emerald-950">手寫簽名已儲存</p>
          <p className="mt-2 text-lg font-semibold text-emerald-800">簽名已與此簽呈綁定，可繼續核准。</p>
        </Panel>
      ) : null}

      <div className={canAct || (!terminal && currentStep) ? "grid gap-6 xl:grid-cols-[1fr_420px]" : "grid gap-6"}>
        <div className="grid gap-5">
          <Panel>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-base font-black text-brand-700">目前狀態</p>
                <h2 className="mt-1 text-4xl font-black text-slate-950">{approvalStageLabel(approval)}</h2>
              </div>
              <StatusBadge label={approvalStatusLabels[approval.status]} tone={statusTone(approval.status)} />
            </div>
          </Panel>

          <Panel className="border-brand-100 bg-brand-50/70">
            <div className="grid gap-4">
              <div>
                <p className="text-base font-black text-brand-700">簽呈目前位置</p>
                <h2 className="mt-1 text-2xl font-black leading-9 text-slate-950">{currentLocationText}</h2>
              </div>
              <div className="grid gap-3 text-base font-semibold leading-7 text-slate-700">
                <p><span className="font-black text-slate-950">完整流向：</span>{flowLine}</p>
                <p><span className="font-black text-slate-950">下一步：</span>{nextActionText}</p>
              </div>
            </div>
          </Panel>

          <Panel>
            <h2 className="mb-4 text-2xl font-black text-slate-950">基本資料</h2>
            <dl className="grid gap-4 text-lg md:grid-cols-2">
              <div><dt className="font-black text-slate-600">所屬單位</dt><dd className="mt-1 font-bold text-slate-950">{emptyText(unitName)}</dd></div>
              <div><dt className="font-black text-slate-600">單位類型</dt><dd className="mt-1 font-bold text-slate-950">{approval.store ? "門市 / 館別" : "部門"}</dd></div>
              <div><dt className="font-black text-slate-600">申請人</dt><dd className="mt-1 font-bold text-slate-950">{approval.applicant.name}</dd></div>
              <div><dt className="font-black text-slate-600">申請時間</dt><dd className="mt-1 font-bold text-slate-950">{formatDateTime(approval.createdAt)}</dd></div>
              <div><dt className="font-black text-slate-600">簽呈類型</dt><dd className="mt-1 font-bold text-slate-950">{approvalTypeLabels[approval.type]}</dd></div>
              <div><dt className="font-black text-slate-600">簽核方式</dt><dd className="mt-1 font-bold text-slate-950">{approvalModeLabel(approval.approvalMode)}</dd></div>
              <div><dt className="font-black text-slate-600">金額</dt><dd className="mt-1 font-bold text-slate-950">{formatAmount(approval.amount)}</dd></div>
              <div><dt className="font-black text-slate-600">最後更新</dt><dd className="mt-1 font-bold text-slate-950">{formatDateTime(approval.updatedAt)}</dd></div>
            </dl>
          </Panel>

          <Panel>
            <h2 className="mb-4 text-2xl font-black text-slate-950">主題</h2>
            <p className="text-3xl font-black leading-tight text-slate-950">{approval.subject}</p>
          </Panel>

          <Panel>
            <h2 className="mb-4 text-2xl font-black text-slate-950">說明事項</h2>
            <p className="whitespace-pre-wrap text-xl font-semibold leading-9 text-slate-800">{sections.description || "未填寫"}</p>
          </Panel>

          <Panel>
            <h2 className="mb-4 text-2xl font-black text-slate-950">解決 / 執行方式</h2>
            <p className="whitespace-pre-wrap text-xl font-semibold leading-9 text-slate-800">{sections.solution || "未填寫"}</p>
          </Panel>

          {latestAttentionLog ? (
            <Panel className="border-amber-200 bg-amber-50">
              <h2 className="mb-2 text-2xl font-black text-amber-950">退回 / 駁回原因</h2>
              <p className="text-base font-bold text-amber-800">
                {approvalActionLabels[latestAttentionLog.action]} · {latestAttentionLog.actor.name} · {formatDateTime(latestAttentionLog.createdAt)}
              </p>
              <p className="mt-3 whitespace-pre-wrap rounded-md bg-white p-4 text-lg font-semibold leading-8 text-amber-950">{latestAttentionLog.comment}</p>
            </Panel>
          ) : null}

          <Panel>
            <h2 className="mb-4 text-2xl font-black text-slate-950">附件</h2>
            <AttachmentPreviewList attachments={approval.attachments} />
          </Panel>

          <Panel>
            <h2 className="mb-4 text-2xl font-black text-slate-950">簽核流程</h2>
            <div className="grid gap-3">
              {approval.steps.map((step) => {
                const isCurrent = currentStep?.id === step.id;
                const statusLabel = stepStatusLabel(step, isCurrent, approval.status);
                return (
                  <div
                    key={step.id}
                    className={isCurrent ? "flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50 p-4" : "flex items-start gap-3 rounded-lg border border-slate-200 p-4"}
                  >
                    <TimelineIcon kind={step.isCompleted ? "done" : approval.status === "REJECTED" ? "rejected" : "waiting"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <p className="text-xl font-black text-slate-950">第 {step.stepOrder} 關：{step.title}</p>
                        <StatusBadge label={statusLabel} tone={step.isCompleted ? "green" : isCurrent ? "amber" : "slate"} />
                      </div>
                      <div className="mt-2 grid gap-1 text-base font-semibold text-slate-700 md:grid-cols-3">
                        <p>簽核單位：<span className="font-black text-slate-950">{userUnitLabel(step.approver)}</span></p>
                        <p>簽核人：<span className="font-black text-slate-950">{safeText(step.approver?.name, "未指定")}</span></p>
                        <p>{step.completedAt ? `完成時間：${formatDateTime(step.completedAt)}` : "完成時間：尚未完成"}</p>
                      </div>
                      {isCurrent ? <p className="mt-2 text-base font-black text-brand-800">目前等待這一關處理。</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          {approval.approvalMode !== "CHECKBOX" ? (
            <Panel>
              <h2 className="mb-4 text-2xl font-black text-slate-950">電子手寫簽名</h2>
              {applicantSignatures.length > 0 ? (
                <div className="mb-5 grid gap-4">
                  <h3 className="text-xl font-black text-slate-950">申請人送出簽名</h3>
                  {applicantSignatures.map((signature) => (
                    <div key={signature.id} className="rounded-lg border border-brand-100 bg-brand-50 p-4">
                      <p className="text-lg font-black text-slate-950">{signature.signer.name} · {formatDateTime(signature.signedAt)}</p>
                      <img className="mt-3 rounded-md border border-slate-200 bg-white" src={signature.signatureDataUrl} alt="申請人手寫簽名" />
                    </div>
                  ))}
                </div>
              ) : null}

              {approverSignatures.length > 0 ? (
                <div className="grid gap-4">
                  <h3 className="text-xl font-black text-slate-950">簽核人核准簽名</h3>
                  {approverSignatures.map((signature) => (
                    <div key={signature.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-lg font-black text-slate-950">{signature.signer.name} · {formatDateTime(signature.signedAt)}</p>
                      <img className="mt-3 rounded-md border border-slate-200 bg-white" src={signature.signatureDataUrl} alt="簽核人電子手寫簽名" />
                    </div>
                  ))}
                </div>
              ) : applicantSignatures.length === 0 ? (
                <p className="text-lg font-semibold text-slate-600">目前尚無手寫簽名。</p>
              ) : null}

              {canAct && !hasCurrentUserSignature ? (
                <div className={applicantSignatures.length > 0 || approverSignatures.length > 0 ? "mt-5" : "mt-5"}>
                  <p className="mb-3 text-lg font-bold text-slate-700">你是目前「{currentStep?.title ?? "簽核"}」的處理人，請先簽名再核准。</p>
                  <SignaturePad approvalId={approval.id} />
                </div>
              ) : canAct && hasCurrentUserSignature ? (
                <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-lg font-bold text-emerald-900">你已完成手寫簽名，可繼續核准。</p>
              ) : null}
            </Panel>
          ) : null}

          {canWriteCommunication ? (
          <Panel>
            <h2 className="mb-4 text-2xl font-black text-slate-950">內部留言</h2>
            <form action={`/api/approvals/${approval.id}/actions`} method="post" className="grid gap-4">
              <input name="action" type="hidden" value="COMMENT" />
              <Field label="留言內容" hint="可補充資料、詢問原因、說明處理狀況。">
                <textarea name="comment" required rows={4} placeholder="請輸入內部留言" />
              </Field>
              <div className="flex justify-end">
                <Button name="action" value="COMMENT" type="submit" variant="secondary">
                  <MessageSquare className="h-5 w-5" />
                  送出留言
                </Button>
              </div>
            </form>
            </Panel>
          ) : (
            <Panel className="border-slate-200 bg-slate-50">
              <h2 className="mb-4 text-2xl font-black text-slate-950">部門溝通紀錄</h2>
              <p className="text-lg font-semibold leading-8 text-slate-700">
                此案屬於部門對部門簽呈，總經理目前保留觀看權限，不開放留言介入。
              </p>
            </Panel>
          )}

          <VoiceThread conversationId={conversation.id} readOnly={!canWriteCommunication} />

          <Panel>
            <h2 className="mb-4 text-2xl font-black text-slate-950">簽核紀錄</h2>
            <div className="grid gap-3">
              {approval.logs.map((log) => (
                <div key={log.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <p className="text-lg font-black text-slate-950">{approvalActionLabels[log.action]} · {userNameWithUnit(log.actor)}</p>
                    <p className="text-sm font-bold text-slate-500">{formatDateTime(log.createdAt)}</p>
                  </div>
                  <p className="mt-2 text-base font-semibold text-slate-600">
                    處理單位：<span className="font-black text-slate-800">{userUnitLabel(log.actor)}</span>
                    <span className="mx-2 text-slate-300">|</span>
                    結果：{log.fromStatus ? approvalStatusLabels[log.fromStatus] : "開始"} → {log.toStatus ? approvalStatusLabels[log.toStatus] : "未變更"}
                  </p>
                  {log.comment ? <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-base leading-7 text-slate-700">{log.comment}</p> : null}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {canAct ? (
          <Panel className="h-fit xl:sticky xl:top-24">
            <h2 className="mb-4 text-2xl font-black text-slate-950">簽核操作</h2>
            <ApprovalActionPanel approvalId={approval.id} requiresSignature={requiresSignatureBeforeApprove} hasSignature={hasCurrentUserSignature} />
            {approval.approvalMode !== "CHECKBOX" ? <p className="mt-4 text-base font-semibold text-slate-600">此簽呈需要手寫簽名，簽名完成後才能核准。</p> : null}
          </Panel>
        ) : !terminal && currentStep ? (
          <Panel className="h-fit xl:sticky xl:top-24">
            <h2 className="mb-4 text-2xl font-black text-slate-950">目前進度</h2>
            <p className="text-lg font-semibold text-slate-700">
              目前等待「{currentStep.title}」處理。你可以查看內容、留言或錄語音，但不能代替簽核人操作。
            </p>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
