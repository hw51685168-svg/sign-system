import { TaskPriority } from "@prisma/client";
import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { hasAnyPermission } from "@/lib/rbac";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { saveUploadedFiles } from "@/lib/uploads";

export const runtime = "nodejs";

async function nextServiceNo() {
  const date = new Date();
  const code = date.toISOString().slice(0, 10).replace(/-/g, "");
  const count = await prisma.serviceRequest.count({
    where: { requestNo: { startsWith: `SR-${code}` } }
  });
  return `SR-${code}-${String(count + 1).padStart(4, "0")}`;
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!hasAnyPermission(user, ["task.create", "issue.create", "approval.create"])) {
    return NextResponse.json({ error: "權限不足，無法建立服務需求。" }, { status: 403 });
  }

  const formData = await request.formData();
  const ownerId = optionalTextValue(formData, "ownerId");
  const responsibleDepartmentId = textValue(formData, "responsibleDepartmentId");
  const dueDate = optionalTextValue(formData, "dueDate");
  const uploads = await saveUploadedFiles(formData, "attachments");

  const serviceRequest = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceRequest.create({
      data: {
        requestNo: await nextServiceNo(),
        title: textValue(formData, "title"),
        category: textValue(formData, "category"),
        serviceName: textValue(formData, "serviceName"),
        requesterId: user.id,
        requesterDepartmentId: user.departmentId,
        businessUnitId: user.businessUnitId,
        responsibleDepartmentId,
        storeId: user.storeId,
        ownerId,
        dueDate: dueDate ? new Date(`${dueDate}T23:59:59+08:00`) : null,
        priority: textValue(formData, "priority") as TaskPriority,
        content: textValue(formData, "content"),
        logs: { create: { actorId: user.id, action: "CREATE", comment: "建立服務需求" } },
        attachments: { create: uploads.map((file) => ({ ...file, uploaderId: user.id })) }
      }
    });

    if (ownerId) {
      await createNotification(
        {
          userId: ownerId,
          title: "新的跨部門服務需求",
          body: created.title,
          type: "SERVICE_REQUEST",
          priority: created.priority === "URGENT" ? "URGENT" : created.priority === "HIGH" ? "HIGH" : "MEDIUM",
          targetUrl: `/services/requests/${created.id}`,
          sourceType: "service_request",
          sourceId: created.id,
          dedupeKey: `service:${created.id}:owner:${ownerId}`
        },
        tx
      );
    }

    return created;
  });

  return appRedirect(`/services/requests/${serviceRequest.id}`);
}
