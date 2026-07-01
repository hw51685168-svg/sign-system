import { ServiceRequestStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { canViewAllBusinessData, isBranchManager, isDepartmentManager, scopedServiceRequestWhere } from "@/lib/rbac";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

const actionLabels: Record<string, string> = {
  ACCEPT: "接單",
  START: "開始處理",
  SUBMIT_COMPLETE: "送完成確認",
  CONFIRM_COMPLETE: "確認完成",
  REJECT_REVISION: "退回修改",
  CLOSE: "結案",
  COMMENT: "留言"
};

function canProcess(user: Awaited<ReturnType<typeof requireUser>>, request: { ownerId: string | null; responsibleDepartmentId: string | null; storeId: string | null }) {
  if (canViewAllBusinessData(user)) return true;
  if (request.ownerId === user.id) return true;
  if (isDepartmentManager(user.roleKey) && request.responsibleDepartmentId === user.departmentId) return true;
  if (isBranchManager(user.roleKey) && request.storeId === user.storeId) return true;
  return false;
}

function canRequesterConfirm(user: Awaited<ReturnType<typeof requireUser>>, request: { requesterId: string; requesterDepartmentId: string | null }) {
  if (canViewAllBusinessData(user)) return true;
  if (request.requesterId === user.id) return true;
  if (isDepartmentManager(user.roleKey) && request.requesterDepartmentId === user.departmentId) return true;
  return false;
}

function nextStatus(action: string, current: ServiceRequestStatus) {
  if (action === "ACCEPT" && current === "SUBMITTED") return "ACCEPTED";
  if (action === "START" && ["SUBMITTED", "ACCEPTED"].includes(current)) return "IN_PROGRESS";
  if (action === "SUBMIT_COMPLETE" && ["ACCEPTED", "IN_PROGRESS"].includes(current)) return "WAITING_CONFIRMATION";
  if (action === "CONFIRM_COMPLETE" && current === "WAITING_CONFIRMATION") return "COMPLETED";
  if (action === "REJECT_REVISION" && current === "WAITING_CONFIRMATION") return "IN_PROGRESS";
  if (action === "CLOSE" && current === "COMPLETED") return "CLOSED";
  return null;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const formData = await request.formData();
  const action = textValue(formData, "action");
  const comment = optionalTextValue(formData, "comment");

  const serviceRequest = await prisma.serviceRequest.findFirst({
    where: { AND: [{ id: params.id }, scopedServiceRequestWhere(user)] },
    include: {
      requester: true,
      owner: true,
      responsibleDepartment: true
    }
  });
  if (!serviceRequest) return NextResponse.json({ error: "找不到服務需求。" }, { status: 404 });

  if (action === "COMMENT") {
    if (!comment) return NextResponse.json({ error: "留言內容不可空白。" }, { status: 400 });
    await prisma.serviceRequestLog.create({
      data: { serviceRequestId: serviceRequest.id, actorId: user.id, action: "COMMENT", comment }
    });
    return appRedirect(`/services/requests/${serviceRequest.id}`);
  }

  const targetStatus = nextStatus(action, serviceRequest.status);
  if (!targetStatus) return NextResponse.json({ error: "目前狀態無法執行此動作。" }, { status: 409 });
  if (action === "REJECT_REVISION" && !comment) {
    return NextResponse.json({ error: "退回修改必須填寫原因。" }, { status: 400 });
  }
  if (["ACCEPT", "START", "SUBMIT_COMPLETE"].includes(action) && !canProcess(user, serviceRequest)) {
    return NextResponse.json({ error: "權限不足，無法處理此服務需求。" }, { status: 403 });
  }
  if (["CONFIRM_COMPLETE", "REJECT_REVISION", "CLOSE"].includes(action) && !canRequesterConfirm(user, serviceRequest)) {
    return NextResponse.json({ error: "只有發起人、發起部門主管或管理層可以確認此服務需求。" }, { status: 403 });
  }

  const ownerId = serviceRequest.ownerId || (["ACCEPT", "START"].includes(action) ? user.id : null);
  await prisma.$transaction(async (tx) => {
    await tx.serviceRequest.update({
      where: { id: serviceRequest.id },
      data: {
        status: targetStatus,
        ownerId: ownerId ?? serviceRequest.ownerId
      }
    });
    await tx.serviceRequestLog.create({
      data: {
        serviceRequestId: serviceRequest.id,
        actorId: user.id,
        action,
        comment: [
          `${actionLabels[action] ?? action}：${serviceRequest.status} → ${targetStatus}`,
          comment ? `說明：${comment}` : null
        ].filter(Boolean).join("\n")
      }
    });

    const notifyIds = Array.from(new Set([serviceRequest.requesterId, ownerId, serviceRequest.ownerId].filter((id): id is string => Boolean(id) && id !== user.id)));
    await Promise.all(
      notifyIds.map((userId) =>
        createNotification(
          {
            userId,
            title: `服務需求已更新：${actionLabels[action] ?? action}`,
            body: serviceRequest.title,
            type: "SERVICE_REQUEST_STATUS",
            priority: serviceRequest.priority === "URGENT" ? "URGENT" : serviceRequest.priority === "HIGH" ? "HIGH" : "MEDIUM",
            targetUrl: `/services/requests/${serviceRequest.id}`,
            sourceType: "service_request",
            sourceId: serviceRequest.id,
            dedupeKey: `service:${serviceRequest.id}:status:${targetStatus}:${user.id}:${Date.now()}`
          },
          tx
        )
      )
    );
  });

  return appRedirect(`/services/requests/${serviceRequest.id}`);
}
