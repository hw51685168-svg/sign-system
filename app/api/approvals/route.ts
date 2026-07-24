import { ApprovalMode, ApprovalType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { textValue, optionalTextValue } from "@/lib/form";
import { nextApprovalNo } from "@/lib/request-no";
import { prisma } from "@/lib/prisma";
import { appRedirect } from "@/lib/redirect";
import { createNotification } from "@/lib/notifications";
import { parseUnitValue } from "@/lib/org-options";
import { revalidateApprovalNavigation } from "@/lib/navigation-revalidate";
import { buildApprovalDescription } from "@/lib/approval-lite";
import { canCreateApprovals, canViewAllBusinessData, dataScope } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { saveUploadedFiles } from "@/lib/uploads";
import { demoMode } from "@/lib/demo";

export const runtime = "nodejs";

const approverRoleKeys = [
  "EXECUTIVE_ASSISTANT",
  "ADMIN_MANAGER",
  "ACCOUNTING_MANAGER",
  "DESIGN_MANAGER",
  "SOCIAL_MEDIA_MANAGER",
  "HR_MANAGER",
  "CONSTRUCTION_MANAGER",
  "BRANCH_MANAGER",
  "MANAGER"
] as const;

const firstRecipientRoleKeys = [...approverRoleKeys, "GENERAL_MANAGER"] as const;

const approvalFlowLabels = {
  DEPARTMENT_ONLY: "部門對部門簽核，不送總經理",
  DIRECT_GM: "申請人簽名後送總經理簽核",
  MANAGER_THEN_GM: "相關部門主管簽核後送總經理",
  GM_THEN_HANDLER: "送總經理簽核後，再交承辦部門"
} as const;

type ApprovalFlow = keyof typeof approvalFlowLabels;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeAmount(input: string | null) {
  if (!input) return null;
  const normalized = input
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, ".")
    .replace(/[，,]/g, "")
    .replace(/新台幣|台幣|臺幣|元整?|NT\$|TWD|\$/gi, "")
    .replace(/\s+/g, "")
    .trim();

  if (!normalized) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("金額格式不正確，請只輸入數字，例如：8600 或 8600.50。");
  }
  return normalized;
}

function isUniqueRequestNoError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && String(error.meta?.target ?? "").includes("requestNo");
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (demoMode) return appRedirect("/approvals");

  if (!canCreateApprovals(user)) {
    return jsonError("你的角色不需要填寫簽呈，請改由待簽核、全部簽呈或交辦任務處理。", 403);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("表單資料讀取失敗，可能是附件太大或網路中斷，請重新送出。", 413);
  }

  const subject = textValue(formData, "subject");
  const description = textValue(formData, "description");
  const solution = textValue(formData, "solution");
  const applicationDate = optionalTextValue(formData, "applicationDate");
  const applicantName = optionalTextValue(formData, "applicantName");
  const position = optionalTextValue(formData, "position");
  const templateHint = optionalTextValue(formData, "templateHint");
  const type = textValue(formData, "type") as ApprovalType;
  const approvalMode = (optionalTextValue(formData, "approvalMode") ?? "MIXED") as ApprovalMode;
  const amountRaw = optionalTextValue(formData, "amount");
  const requestedUnit = parseUnitValue(optionalTextValue(formData, "unitId"));
  const requestedDepartmentId = requestedUnit?.type === "department" ? requestedUnit.id : optionalTextValue(formData, "departmentId");
  const requestedStoreId = requestedUnit?.type === "store" ? requestedUnit.id : optionalTextValue(formData, "storeId");
  const firstApproverId = textValue(formData, "firstApproverId");
  const secondApproverId = optionalTextValue(formData, "secondApproverId");
  const finalHandlerId = optionalTextValue(formData, "finalHandlerId");
  const applicantSignatureDataUrl = textValue(formData, "applicantSignatureDataUrl");

  if (!subject || !description || !solution || !firstApproverId || !Object.values(ApprovalType).includes(type)) {
    return jsonError("請填寫主題、說明事項、解決 / 執行方式，並選擇第一關簽核人。");
  }

  if (!Object.values(ApprovalMode).includes(approvalMode)) {
    return jsonError("簽核模式不正確，請重新選擇。");
  }

  if (!applicantSignatureDataUrl.startsWith("data:image/png;base64,")) {
    return jsonError("送出簽呈前，請先完成申請人手寫簽名。");
  }

  let amount: string | null;
  try {
    amount = normalizeAmount(amountRaw);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "金額格式不正確，請重新輸入。");
  }

  const scope = dataScope(user);
  const departmentId = canViewAllBusinessData(user) ? (requestedStoreId ? null : (requestedDepartmentId ?? user.departmentId)) : user.departmentId;
  const storeId = scope === "STORE" ? user.storeId : canViewAllBusinessData(user) ? (requestedStoreId ?? user.storeId) : user.storeId;

  const [firstApprover, secondApprover, finalHandler] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: firstApproverId,
        isActive: true,
        role: { key: { in: [...firstRecipientRoleKeys] } }
      },
      include: { role: true, department: true }
    }),
    secondApproverId
      ? prisma.user.findFirst({
          where: { id: secondApproverId, isActive: true, role: { key: "GENERAL_MANAGER" } },
          include: { role: true, department: true }
        })
      : null,
    finalHandlerId
      ? prisma.user.findFirst({
          where: {
            id: finalHandlerId,
            isActive: true,
            role: { key: { in: [...approverRoleKeys] } }
          },
          include: { role: true, department: true }
        })
      : null
  ]);

  if (!firstApprover) {
    return jsonError("找不到第一位收件 / 簽核人，請確認該人員仍啟用且具備主管、承辦或總經理權限。");
  }

  const firstApproverIsGeneralManager = firstApprover.role.key === "GENERAL_MANAGER";

  if (finalHandlerId && !firstApproverIsGeneralManager && !secondApproverId) {
    return jsonError("若要指定總經理核准後承辦人，請先選擇總經理簽核；也可以第一關直接選總經理。");
  }

  if (secondApproverId && !secondApprover) {
    return jsonError("找不到總經理簽核人，請重新選擇。");
  }

  if (finalHandlerId && !finalHandler) {
    return jsonError("找不到承辦人，請確認該人員仍啟用且具備主管或承辦權限。");
  }

  const selectedPeople = [firstApprover, secondApprover, finalHandler].filter(Boolean) as Array<{ id: string }>;
  if (selectedPeople.some((person) => person.id === user.id)) {
    return jsonError("申請人簽名已在送出前完成，不能再把自己選為簽核人或承辦人。請改選其他部門或總經理。");
  }
  if (new Set(selectedPeople.map((person) => person.id)).size !== selectedPeople.length) {
    return jsonError("同一個人不需要重複出現在簽核流程中，請調整第一關、總經理或承辦人。");
  }

  const approvalFlow: ApprovalFlow = firstApproverIsGeneralManager
    ? finalHandler
      ? "GM_THEN_HANDLER"
      : "DIRECT_GM"
    : finalHandler
      ? "GM_THEN_HANDLER"
      : secondApprover
        ? "MANAGER_THEN_GM"
        : "DEPARTMENT_ONLY";

  let uploads: Awaited<ReturnType<typeof saveUploadedFiles>>;
  try {
    uploads = [
      ...(await saveUploadedFiles(formData, "attachments")),
      ...(await saveUploadedFiles(formData, "photos")),
      ...(await saveUploadedFiles(formData, "documents"))
    ];
  } catch {
    return jsonError("附件儲存失敗，請確認檔案沒有損壞，或先移除附件後再送出。", 400);
  }

  const basicInfo = [
    applicationDate ? `申請日期：${applicationDate}` : null,
    applicantName ? `申請人：${applicantName}` : null,
    position ? `職位：${position}` : null,
    templateHint ? `簽呈類型提示：${templateHint}` : null,
    `簽核流程：${approvalFlowLabels[approvalFlow]}`,
    `第一關：${firstApprover.name}${firstApprover.department?.name ? `（${firstApprover.department.name}）` : ""}`,
    secondApprover ? `總經理簽核：${secondApprover.name}` : null,
    finalHandler ? `承辦人：${finalHandler.name}${finalHandler.department?.name ? `（${finalHandler.department.name}）` : ""}` : null
  ]
    .filter(Boolean)
    .join("\n");

  const content = buildApprovalDescription(`${basicInfo}\n\n${description}`, solution);
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
  const userAgent = request.headers.get("user-agent");
  const stepCreates = [{ stepOrder: 1, title: firstApproverIsGeneralManager ? "總經理簽核" : "相關部門主管 / 承辦主管簽核", approverId: firstApprover.id }];

  if (!firstApproverIsGeneralManager && secondApprover) {
    stepCreates.push({ stepOrder: stepCreates.length + 1, title: "總經理簽核", approverId: secondApprover.id });
  }

  if (finalHandler) {
    stepCreates.push({ stepOrder: stepCreates.length + 1, title: "核准後承辦部門確認", approverId: finalHandler.id });
  }

  let approval: { id: string } | null = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      approval = await prisma.$transaction(async (tx) => {
        const created = await tx.approvalRequest.create({
          data: {
            requestNo: await nextApprovalNo(),
            applicantId: user.id,
            departmentId,
            storeId,
            type,
            approvalMode,
            subject,
            description: content,
            amount,
            status: "REVIEWING",
            steps: { create: stepCreates },
            logs: {
              create: {
                actorId: user.id,
                action: "SUBMIT",
                toStatus: "REVIEWING",
                comment: `送出簽呈：${approvalFlowLabels[approvalFlow]}`,
                ipAddress,
                userAgent
              }
            },
            signatures: {
              create: {
                signerId: user.id,
                signaturePurpose: "APPLICANT",
                signatureDataUrl: applicantSignatureDataUrl,
                contentSnapshot: JSON.stringify({
                  purpose: "APPLICANT_SUBMISSION",
                  subject,
                  description: content,
                  amount,
                  applicantName: applicantName ?? user.name,
                  contentVersion: 1,
                  signedAt: new Date().toISOString()
                }),
                ipAddress,
                userAgent
              }
            },
            attachments: {
              create: uploads.map((file) => ({ ...file, uploaderId: user.id }))
            }
          }
        });

        await createNotification(
          {
            userId: firstApprover.id,
            title: `待簽核：${subject}`,
            body: `${user.name} 送出一筆簽呈，請進入 JU數位管理查看。`,
            type: "APPROVAL_PENDING",
            priority: "HIGH",
            targetUrl: `/approvals/${created.id}`,
            sourceType: "approval",
            sourceId: created.id,
            dedupeKey: `approval:${created.id}:pending:${firstApprover.id}`
          },
          tx
        );

        return created;
      });
      break;
    } catch (error) {
      if (attempt < 5 && isUniqueRequestNoError(error)) continue;
      console.error("Approval submit failed", error);
      return jsonError("簽呈送出失敗，請確認欄位與附件後再送出一次。若仍失敗請通知系統管理員。", 500);
    }
  }

  if (!approval) return jsonError("簽呈送出失敗，請重新送出。", 500);

  revalidateApprovalNavigation(approval.id);
  return appRedirect(`/approvals/${approval.id}?created=1`);
}
