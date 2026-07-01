import { notFound } from "next/navigation";
import { Check, Download, MessageSquare, RotateCcw, Send, UserPlus, X } from "lucide-react";
import { Button, Field, LinkButton, PageHeader, Panel, StatusBadge, statusTone, TimelineIcon } from "@/components/ui";
import { ApprovalActionPanel } from "@/components/approval-action-panel";
import { SignaturePad } from "@/components/signature-pad";
import { VoiceThread } from "@/components/voice-thread";
import { isApprovalLiteMode } from "@/lib/app-mode";
import { approvalStageLabel, canUseApprovalAction, parseApprovalDescription } from "@/lib/approval-lite";
import { approvalActionLabels, approvalStatusLabels, approvalTypeLabels, formatAmount, formatDateTime } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { canApprove, scopedApprovalWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { demoApprovals, demoMode, demoUsers } from "@/lib/demo";
import { getOrCreateConversation } from "@/lib/voice";

export default async function ApprovalDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { created?: string; actionResult?: string; actionError?: string; signature?: string };
}) {
  const user = await requireUser();
  if (demoMode) {
    const approval = demoApprovals.find((item) => item.id === params.id) ?? demoApprovals[0];
    const approvers = demoUsers.filter((item) => ["GENERAL_MANAGER", "MANAGER"].includes(item.role.key));
    const steps = [
      { id: "step-1", stepOrder: 1, title: "行政主管審核", approver: { name: "行政主管" }, isCompleted: false, completedAt: null },
      { id: "step-2", stepOrder: 2, title: "總經理核准", approver: { name: "皇享總經理" }, isCompleted: false, completedAt: null }
    ];
    const logs = [
      { id: "log-1", action: "SUBMIT", actor: { name: approval.applicant.name }, fromStatus: null, toStatus: approval.status, comment: "送出簽呈", createdAt: approval.createdAt }
    ];
    return (
      <>
        <PageHeader
          title={approval.subject}
          description={`${approval.requestNo} · ${approvalTypeLabels[approval.type as keyof typeof approvalTypeLabels]} · ${approval.applicant.name}`}
          actions={<StatusBadge label={approvalStatusLabels[approval.status as keyof typeof approvalStatusLabels]} tone={statusTone(approval.status)} />}
        />
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="grid gap-6">
            <Panel>
              <h2 className="mb-4 font-bold text-slate-950">簽呈內容</h2>
              <dl className="grid gap-4 text-sm md:grid-cols-2">
                <div><dt className="text-slate-500">申請人</dt><dd className="mt-1 font-semibold">{approval.applicant.name}</dd></div>
                <div><dt className="text-slate-500">部門 / 門市</dt><dd className="mt-1 font-semibold">{approval.department?.name ?? "-"} {approval.store?.name ? ` / ${approval.store.name}` : ""}</dd></div>
                <div><dt className="text-slate-500">金額</dt><dd className="mt-1 font-semibold">{approval.amount ? `NT$ ${approval.amount}` : "-"}</dd></div>
                <div><dt className="text-slate-500">建立 / 更新</dt><dd className="mt-1 font-semibold">{formatDateTime(approval.createdAt)} / {formatDateTime(approval.updatedAt)}</dd></div>
              </dl>
              <div className="mt-5 whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm leading-7 text-slate-700">{approval.description}</div>
            </Panel>
            <Panel>
              <h2 className="mb-4 font-bold text-slate-950">簽核流程</h2>
              <div className="grid gap-3">{steps.map((step) => <div key={step.id} className="flex items-start gap-3 rounded-md border border-slate-200 p-3"><TimelineIcon kind={step.isCompleted ? "done" : "waiting"} /><div><p className="font-semibold text-slate-900">第 {step.stepOrder} 關：{step.title}</p><p className="mt-1 text-sm text-slate-500">簽核人：{step.approver.name} · 待處理</p></div></div>)}</div>
            </Panel>
            <Panel><h2 className="mb-4 font-bold text-slate-950">附件與照片</h2><p className="text-sm text-slate-500">預覽模式尚未儲存附件。</p></Panel>
            <Panel>
              <h2 className="mb-4 font-bold text-slate-950">操作紀錄</h2>
              <div className="grid gap-3">{logs.map((log) => <div key={log.id} className="rounded-md border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{approvalActionLabels[log.action as keyof typeof approvalActionLabels]} · {log.actor.name}</p><p className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</p></div>{log.comment ? <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{log.comment}</p> : null}</div>)}</div>
            </Panel>
          </div>
          <Panel>
            <h2 className="mb-4 font-bold text-slate-950">簽核動作</h2>
            <form action={`/api/approvals/${approval.id}/actions`} method="post" className="grid gap-4">
              <Field label="留言"><textarea name="comment" placeholder="請輸入核准、駁回、退回補件或轉派原因。" /></Field>
              <Field label="加簽 / 轉派對象"><select name="targetApproverId"><option value="">不指定</option>{approvers.map((approver) => <option key={approver.id} value={approver.id}>{approver.name}（{approver.role.name}）</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-2">
                <Button name="action" value="APPROVE" type="submit"><Check className="h-4 w-4" />核准</Button>
                <Button name="action" value="REJECT" type="submit" variant="danger"><X className="h-4 w-4" />駁回</Button>
                <Button name="action" value="REQUEST_REVISION" type="submit" variant="secondary"><RotateCcw className="h-4 w-4" />退回補件</Button>
                <Button name="action" value="ADD_APPROVER" type="submit" variant="secondary"><UserPlus className="h-4 w-4" />加簽</Button>
                <Button name="action" value="TRANSFER" type="submit" variant="secondary"><Send className="h-4 w-4" />轉派</Button>
                <Button name="action" value="COMMENT" type="submit" variant="secondary"><MessageSquare className="h-4 w-4" />留言</Button>
              </div>
            </form>
          </Panel>
        </div>
      </>
    );
  }
  const approval = await prisma.approvalRequest.findFirst({
    where: { AND: [{ id: params.id }, scopedApprovalWhere(user)] },
    include: {
      applicant: true,
      department: true,
      store: true,
      steps: { include: { approver: true }, orderBy: { stepOrder: "asc" } },
      logs: { include: { actor: true }, orderBy: { createdAt: "desc" } },
      signatures: { include: { signer: true }, orderBy: { signedAt: "desc" } },
      attachments: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!approval) notFound();

  const latestAttentionLog = approval.logs.find((log) => ["REJECT", "REQUEST_REVISION"].includes(log.action) && log.comment);
  const liteMode = isApprovalLiteMode();
  const sections = parseApprovalDescription(approval.description);
  const canAct = canUseApprovalAction(user, approval);
  const hasCurrentUserSignature = approval.signatures.some((signature) => signature.signerId === user.id);
  const requiresSignatureBeforeApprove = user.roleKey === "GENERAL_MANAGER" && approval.approvalMode !== "CHECKBOX";
  const actionResultMessages: Record<string, { title: string; body: string }> = {
    approved: { title: "已核准", body: "簽呈已進入下一關，後續可在部門簽呈進度追蹤。" },
    "approved-final": { title: "已完成核准", body: "簽呈已完成最後一關核准。" },
    rejected: { title: "已駁回", body: "駁回原因已寫入簽核紀錄，並通知申請人。" },
    revision: { title: "已退回修改", body: "退回修改說明已寫入簽核紀錄，並通知申請人補正。" },
    comment: { title: "留言已送出", body: "內部留言已寫入簽核紀錄。" }
  };
  const actionResultMessage = searchParams?.actionResult ? actionResultMessages[searchParams.actionResult] : null;

  if (liteMode) {
    return (
      <>
        <PageHeader
          title={approval.subject}
          description={`${approval.requestNo} · 內部簽呈請示單 · ${approval.applicant.name}`}
          actions={
            <>
              <LinkButton href="/approvals/progress" variant="secondary">返回簽呈進度</LinkButton>
              <LinkButton href={`/api/approvals/${approval.id}/export`} variant="secondary" target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                下載 PDF
              </LinkButton>
              <StatusBadge label={approvalStageLabel(approval)} tone={statusTone(approval.status)} />
            </>
          }
        />

        {searchParams?.created === "1" ? (
          <Panel className="mb-5 border-emerald-200 bg-emerald-50">
            <p className="text-2xl font-black text-emerald-950">簽呈已送出</p>
            <p className="mt-2 text-lg font-semibold text-emerald-800">
              已進入部門主管審核中，可在「我的簽呈進度」追蹤目前狀態。
            </p>
          </Panel>
        ) : null}

        {actionResultMessage ? (
          <Panel className="mb-5 border-emerald-200 bg-emerald-50">
            <p className="text-2xl font-black text-emerald-950">{actionResultMessage.title}</p>
            <p className="mt-2 text-lg font-semibold text-emerald-800">{actionResultMessage.body}</p>
          </Panel>
        ) : null}

        {searchParams?.actionError ? (
          <Panel className="mb-5 border-red-200 bg-red-50">
            <p className="text-2xl font-black text-red-950">操作沒有完成</p>
            <p className="mt-2 text-lg font-semibold text-red-800">{searchParams.actionError}</p>
          </Panel>
        ) : null}

        {searchParams?.signature === "1" ? (
          <Panel className="mb-5 border-emerald-200 bg-emerald-50">
            <p className="text-2xl font-black text-emerald-950">電子手寫簽名已儲存</p>
            <p className="mt-2 text-lg font-semibold text-emerald-800">簽名已與此簽呈綁定，後續不可任意修改。</p>
          </Panel>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="grid gap-5">
            <Panel>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-black text-brand-700">簽呈狀態</p>
                  <h2 className="mt-1 text-4xl font-black text-slate-950">{approvalStageLabel(approval)}</h2>
                </div>
                <StatusBadge label={approvalStatusLabels[approval.status]} tone={statusTone(approval.status)} />
              </div>
            </Panel>

            <Panel>
              <h2 className="mb-4 text-2xl font-black text-slate-950">基本資料</h2>
              <dl className="grid gap-4 text-lg md:grid-cols-2">
                <div><dt className="font-black text-slate-600">部門</dt><dd className="mt-1 font-bold text-slate-950">{approval.department?.name ?? "未指定"}</dd></div>
                <div><dt className="font-black text-slate-600">申請日期</dt><dd className="mt-1 font-bold text-slate-950">{formatDateTime(approval.createdAt)}</dd></div>
                <div><dt className="font-black text-slate-600">申請人</dt><dd className="mt-1 font-bold text-slate-950">{approval.applicant.name}</dd></div>
                <div><dt className="font-black text-slate-600">職位</dt><dd className="mt-1 font-bold text-slate-950">依帳號角色</dd></div>
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
              {approval.attachments.length === 0 ? (
                <p className="text-lg font-semibold text-slate-600">尚未上傳附件。</p>
              ) : (
                <div className="grid gap-2">
                  {approval.attachments.map((attachment) => (
                    <a key={attachment.id} className="rounded-md border border-slate-200 px-4 py-3 text-lg font-bold text-brand-700 hover:bg-slate-50" href={attachment.fileUrl} target="_blank">
                      {attachment.fileName}
                    </a>
                  ))}
                </div>
              )}
            </Panel>

            <Panel>
              <h2 className="mb-4 text-2xl font-black text-slate-950">簽核流程</h2>
              <div className="grid gap-3">
                {approval.steps.map((step) => (
                  <div key={step.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
                    <TimelineIcon kind={step.isCompleted ? "done" : "waiting"} />
                    <div>
                      <p className="text-xl font-black text-slate-950">第 {step.stepOrder} 關：{step.title}</p>
                      <p className="mt-1 text-base font-semibold text-slate-600">
                        簽核人：{step.approver?.name ?? "未指定"} · {step.completedAt ? formatDateTime(step.completedAt) : "待處理"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {approval.approvalMode !== "CHECKBOX" ? (
              <Panel>
                <h2 className="mb-4 text-2xl font-black text-slate-950">電子手寫簽名</h2>
                {approval.signatures.length > 0 ? (
                  <div className="grid gap-4">
                    {approval.signatures.map((signature) => (
                      <div key={signature.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-lg font-black text-slate-950">{signature.signer.name} · {formatDateTime(signature.signedAt)}</p>
                        <img className="mt-3 rounded-md border border-slate-200 bg-white" src={signature.signatureDataUrl} alt="電子手寫簽名" />
                      </div>
                    ))}
                  </div>
                ) : canAct ? (
                  <SignaturePad approvalId={approval.id} />
                ) : (
                  <p className="text-lg font-semibold text-slate-600">尚未簽名，需由目前簽核人完成。</p>
                )}
              </Panel>
            ) : null}

            <Panel>
              <h2 className="mb-4 text-2xl font-black text-slate-950">簽核紀錄</h2>
              <div className="grid gap-3">
                {approval.logs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <p className="text-lg font-black text-slate-950">{approvalActionLabels[log.action]} · {log.actor.name}</p>
                      <p className="text-sm font-bold text-slate-500">{formatDateTime(log.createdAt)}</p>
                    </div>
                    {log.comment ? <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-base leading-7 text-slate-700">{log.comment}</p> : null}
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <Panel className="h-fit xl:sticky xl:top-24">
            <h2 className="mb-4 text-2xl font-black text-slate-950">核准結果 / 操作</h2>
            {canAct ? (
              <>
                <ApprovalActionPanel approvalId={approval.id} requiresSignature={requiresSignatureBeforeApprove} hasSignature={hasCurrentUserSignature} />
                {approval.approvalMode !== "CHECKBOX" ? <p className="mt-4 text-base font-semibold text-slate-600">此簽呈需要電子手寫簽名；請先完成簽名，再按核准。</p> : null}
              </>
            ) : (
              <div className="grid gap-3">
                <p className="text-lg font-semibold text-slate-700">目前只能查看進度與結果。</p>
                {approval.status === "NEEDS_REVISION" && approval.applicantId === user.id ? (
                  <LinkButton href="/approvals/new">修改後重新送出</LinkButton>
                ) : null}
                <LinkButton href={`/api/approvals/${approval.id}/export`} variant="secondary" target="_blank" rel="noopener noreferrer">下載 PDF</LinkButton>
              </div>
            )}
          </Panel>
        </div>
      </>
    );
  }

  const approvers = await prisma.user.findMany({
    where: { isActive: true, role: { key: { in: ["GENERAL_MANAGER", "MANAGER"] } } },
    include: { role: true },
    orderBy: { name: "asc" }
  });
  const conversation = await getOrCreateConversation({
    type: "APPROVAL",
    sourceType: "approval",
    sourceId: approval.id,
    title: `簽呈：${approval.subject}`,
    departmentId: approval.departmentId,
    storeId: approval.storeId,
    createdById: user.id
  });

  return (
    <>
      <PageHeader
        title={approval.subject}
        description={`${approval.requestNo} · ${approvalTypeLabels[approval.type]} · ${approval.applicant.name}`}
        actions={
          <>
            <LinkButton href={`/api/approvals/${approval.id}/export`} variant="secondary" target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
              匯出 PDF（含簽名）
            </LinkButton>
            <StatusBadge label={approvalStatusLabels[approval.status]} tone={statusTone(approval.status)} />
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-6">
          <Panel>
            <h2 className="mb-4 font-bold text-slate-950">簽呈內容</h2>
            <dl className="grid gap-4 text-sm md:grid-cols-2">
              <div>
                <dt className="text-slate-500">申請人</dt>
                <dd className="mt-1 font-semibold">{approval.applicant.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">部門 / 門市</dt>
                <dd className="mt-1 font-semibold">
                  {approval.department?.name ?? "-"} {approval.store?.name ? ` / ${approval.store.name}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">金額</dt>
                <dd className="mt-1 font-semibold">{formatAmount(approval.amount)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Approval Mode（簽核模式）</dt>
                <dd className="mt-1 font-semibold">
                  {approval.approvalMode === "CHECKBOX" ? "checkbox（打勾式簽核）" : approval.approvalMode === "HANDWRITTEN" ? "handwritten（電子手寫簽名）" : "mixed（打勾 + 手寫簽名）"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">建立 / 更新</dt>
                <dd className="mt-1 font-semibold">
                  {formatDateTime(approval.createdAt)} / {formatDateTime(approval.updatedAt)}
                </dd>
              </div>
            </dl>
            <div className="mt-5 rounded-md bg-slate-50 p-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">{approval.description}</div>
          </Panel>

          {latestAttentionLog ? (
            <Panel className="border-amber-200 bg-amber-50">
              <h2 className="mb-2 font-bold text-amber-950">需處理原因</h2>
              <p className="text-sm text-amber-800">
                {approvalActionLabels[latestAttentionLog.action]} · {latestAttentionLog.actor.name} · {formatDateTime(latestAttentionLog.createdAt)}
              </p>
              <p className="mt-3 whitespace-pre-wrap rounded-md bg-white p-3 text-sm leading-6 text-amber-950">{latestAttentionLog.comment}</p>
            </Panel>
          ) : null}

          <Panel>
            <h2 className="mb-4 font-bold text-slate-950">簽核流程</h2>
            <div className="grid gap-3">
              {approval.steps.map((step) => (
                <div key={step.id} className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
                  <TimelineIcon kind={step.isCompleted ? "done" : "waiting"} />
                  <div>
                    <p className="font-semibold text-slate-900">
                      第 {step.stepOrder} 關：{step.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      簽核人：{step.approver?.name ?? "未指定"} · {step.completedAt ? formatDateTime(step.completedAt) : "待處理"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="mb-4 font-bold text-slate-950">附件與照片</h2>
            {approval.attachments.length === 0 ? (
              <p className="text-sm text-slate-500">尚未上傳附件。</p>
            ) : (
              <div className="grid gap-2">
                {approval.attachments.map((attachment) => (
                  <a key={attachment.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-brand-700 hover:bg-slate-50" href={attachment.fileUrl} target="_blank">
                    {attachment.fileName}
                  </a>
                ))}
              </div>
            )}
          </Panel>

          {approval.approvalMode !== "CHECKBOX" ? (
            <Panel>
              <h2 className="mb-4 font-bold text-slate-950">Handwritten Signature（電子手寫簽名）</h2>
              {approval.signatures.length > 0 ? (
                <div className="grid gap-4">
                  {approval.signatures.map((signature) => (
                    <div key={signature.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="font-bold text-slate-950">{signature.signer.name} · {formatDateTime(signature.signedAt)}</p>
                      <img className="mt-3 rounded-md border border-slate-200 bg-white" src={signature.signatureDataUrl} alt="電子手寫簽名" />
                    </div>
                  ))}
                </div>
              ) : canApprove(user) ? (
                <SignaturePad approvalId={approval.id} />
              ) : (
                <p className="text-base text-slate-600">尚未簽名，需由有簽核權限的人員完成。</p>
              )}
            </Panel>
          ) : null}

          <Panel>
            <h2 className="mb-4 font-bold text-slate-950">操作紀錄</h2>
            <div className="grid gap-3">
              {approval.logs.map((log) => (
                <div key={log.id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">
                      {approvalActionLabels[log.action]} · {log.actor.name}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {log.fromStatus ? approvalStatusLabels[log.fromStatus] : "-"} → {log.toStatus ? approvalStatusLabels[log.toStatus] : "-"}
                  </p>
                  {log.comment ? <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{log.comment}</p> : null}
                </div>
              ))}
            </div>
          </Panel>

          <VoiceThread conversationId={conversation.id} />
        </div>

        <div className="grid gap-6">
          <Panel>
            <h2 className="mb-4 font-bold text-slate-950">內部留言</h2>
            <form action={`/api/approvals/${approval.id}/actions`} method="post" className="grid gap-4">
              <input name="action" type="hidden" value="COMMENT" />
              <Field label="留言內容" hint="同一張簽呈內追問原因、補充資料或同步處理狀況。">
                <textarea name="comment" required placeholder="請輸入要留給相關人員的訊息。" />
              </Field>
              <div className="flex justify-end">
                <Button name="action" value="COMMENT" type="submit" variant="secondary">
                  <MessageSquare className="h-4 w-4" />
                  送出留言
                </Button>
              </div>
            </form>
          </Panel>

          <Panel>
            <h2 className="mb-4 font-bold text-slate-950">主管操作區</h2>
          {canApprove(user) && !["APPROVED", "REJECTED", "CLOSED"].includes(approval.status) ? (
            <form action={`/api/approvals/${approval.id}/actions`} method="post" className="grid gap-4">
              <Field label="簽核意見 / 原因" hint="駁回或退回補件時必填，方便申請人依原因修正。">
                <textarea name="comment" placeholder="核准可簡短備註；駁回或退回補件請務必填原因。" />
              </Field>
              <div className="grid gap-2">
                <Button name="action" value="APPROVE" type="submit">
                  <Check className="h-4 w-4" />
                  核准
                </Button>
                <Button name="action" value="REJECT" type="submit" variant="danger">
                  <X className="h-4 w-4" />
                  駁回
                </Button>
                <Button name="action" value="REQUEST_REVISION" type="submit" variant="secondary">
                  <RotateCcw className="h-4 w-4" />
                  退回補件
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-base text-slate-600">{["APPROVED", "REJECTED", "CLOSED"].includes(approval.status) ? "此簽呈已完成審核，只能查看紀錄。" : "你可以查看此簽呈，目前沒有簽核操作權限。"}</p>
          )}
          </Panel>
        </div>
      </div>
    </>
  );
}
