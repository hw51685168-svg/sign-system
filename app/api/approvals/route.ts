import { ApprovalMode, ApprovalType } from "@prisma/client";
import { NextResponse } from "next/server";
import { textValue, optionalTextValue } from "@/lib/form";
import { nextApprovalNo } from "@/lib/request-no";
import { prisma } from "@/lib/prisma";
import { appRedirect } from "@/lib/redirect";
import { createNotification } from "@/lib/notifications";
import { revalidateApprovalNavigation } from "@/lib/navigation-revalidate";
import { buildApprovalDescription } from "@/lib/approval-lite";
import { canViewAllBusinessData, dataScope, hasPermission } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { saveUploadedFiles } from "@/lib/uploads";
import { demoMode } from "@/lib/demo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireUser();
  if (demoMode) return appRedirect("/approvals");
  if (!hasPermission(user, "approval.create")) {
    return NextResponse.json({ error: "權限不足，無法建立簽呈。" }, { status: 403 });
  }
  const formData = await request.formData();
  const subject = textValue(formData, "subject");
  const description = textValue(formData, "description");
  const solution = optionalTextValue(formData, "solution");
  const applicationDate = optionalTextValue(formData, "applicationDate");
  const applicantName = optionalTextValue(formData, "applicantName");
  const position = optionalTextValue(formData, "position");
  const templateHint = optionalTextValue(formData, "templateHint");
  const type = textValue(formData, "type") as ApprovalType;
  const approvalMode = (optionalTextValue(formData, "approvalMode") ?? "CHECKBOX") as ApprovalMode;
  const amount = optionalTextValue(formData, "amount");
  const requestedDepartmentId = optionalTextValue(formData, "departmentId");
  const requestedStoreId = optionalTextValue(formData, "storeId");
  const scope = dataScope(user);
  const departmentId = canViewAllBusinessData(user) ? (requestedDepartmentId ?? user.departmentId) : user.departmentId;
  const storeId = scope === "STORE" ? user.storeId : canViewAllBusinessData(user) ? (requestedStoreId ?? user.storeId) : user.storeId;
  const firstApproverId = textValue(formData, "firstApproverId");
  const secondApproverId = optionalTextValue(formData, "secondApproverId");
  const [firstApprover, secondApprover] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: firstApproverId,
        isActive: true,
        role: {
          key: {
            in: [
              "EXECUTIVE_ASSISTANT",
              "ADMIN_MANAGER",
              "ACCOUNTING_MANAGER",
              "DESIGN_MANAGER",
              "SOCIAL_MEDIA_MANAGER",
              "HR_MANAGER",
              "CONSTRUCTION_MANAGER",
              "BRANCH_MANAGER",
              "MANAGER"
            ]
          }
        }
      },
      include: { role: true }
    }),
    secondApproverId
      ? prisma.user.findFirst({
          where: { id: secondApproverId, isActive: true, role: { key: "GENERAL_MANAGER" } },
          include: { role: true }
        })
      : null
  ]);

  if (!firstApprover) {
    return NextResponse.json({ error: "請選擇有效的相關部門主管簽核人。" }, { status: 400 });
  }
  if (secondApproverId && !secondApprover) {
    return NextResponse.json({ error: "請選擇有效的總經理簽核人。" }, { status: 400 });
  }

  const uploads = [
    ...(await saveUploadedFiles(formData, "attachments")),
    ...(await saveUploadedFiles(formData, "photos")),
    ...(await saveUploadedFiles(formData, "documents"))
  ];
  const basicInfo = [
    applicationDate ? `申請日期：${applicationDate}` : null,
    applicantName ? `申請人：${applicantName}` : null,
    position ? `職位：${position}` : null,
    templateHint ? `常用簽呈情境：${templateHint}` : null
  ].filter(Boolean).join("\n");
  const content = solution
    ? buildApprovalDescription(`${basicInfo ? `${basicInfo}\n\n` : ""}${description}`, solution)
    : `${basicInfo ? `${basicInfo}\n\n` : ""}${description}`;

  const approval = await prisma.$transaction(async (tx) => {
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
        amount: amount || null,
        status: "REVIEWING",
        steps: {
          create: [
            { stepOrder: 1, title: "相關部門主管簽核", approverId: firstApprover.id },
            ...(secondApproverId ? [{ stepOrder: 2, title: "總經理簽核", approverId: secondApproverId }] : [])
          ]
        },
        logs: {
          create: {
            actorId: user.id,
            action: "SUBMIT",
            toStatus: "REVIEWING",
            comment: "送出簽呈"
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
        title: "有新的簽呈待審核",
        body: `${user.name} 送出：${subject}`,
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

  revalidateApprovalNavigation(approval.id);
  return appRedirect(`/approvals/${approval.id}?created=1`);
}
