import { TaskPriority } from "@prisma/client";
import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { createNotification } from "@/lib/notifications";
import { revalidateGmTaskNavigation } from "@/lib/navigation-revalidate";
import { parseUnitValue } from "@/lib/org-options";
import { prisma } from "@/lib/prisma";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { saveUploadedFiles } from "@/lib/uploads";

function canCreateGmTask(roleKey: string) {
  return ["GENERAL_MANAGER", "SYSTEM_ADMIN", "EXECUTIVE_ASSISTANT"].includes(roleKey);
}

function requestMeta(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null,
    userAgent: request.headers.get("user-agent")
  };
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!canCreateGmTask(user.roleKey)) {
    return NextResponse.json({ error: "你沒有建立總經理交辦任務的權限。" }, { status: 403 });
  }

  const formData = await request.formData();
  const title = textValue(formData, "title");
  const ownerId = textValue(formData, "ownerId");
  const requestedUnit = parseUnitValue(optionalTextValue(formData, "unitId"));
  const rawDepartmentId = requestedUnit?.type === "department" ? requestedUnit.id : optionalTextValue(formData, "departmentId");
  const rawStoreId = requestedUnit?.type === "store" ? requestedUnit.id : null;
  const dueDate = optionalTextValue(formData, "dueDate");
  const priority = (optionalTextValue(formData, "priority") ?? "MEDIUM") as TaskPriority;
  const rawContent = textValue(formData, "content");
  const requiresReport = String(formData.get("requiresReport") || "") === "on";
  const uploads = await saveUploadedFiles(formData, "attachments");
  const meta = requestMeta(request);

  if (!title || !ownerId || !rawContent) {
    return NextResponse.json({ error: "請填寫任務標題、指派人員與交辦內容。" }, { status: 400 });
  }
  if (!Object.values(TaskPriority).includes(priority)) {
    return NextResponse.json({ error: "任務優先級不正確。" }, { status: 400 });
  }
  if (ownerId === user.id) {
    return NextResponse.json({ error: "交辦任務不能指派給自己，請選擇其他測試帳號。" }, { status: 400 });
  }

  const owner = await prisma.user.findFirst({
    where: { id: ownerId, isActive: true },
    include: { department: true }
  });
  if (!owner) return NextResponse.json({ error: "找不到可指派的人員。" }, { status: 404 });

  const departmentId = rawStoreId ? null : (rawDepartmentId ?? owner.departmentId);
  const storeId = rawStoreId ?? null;
  if (departmentId) {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) return NextResponse.json({ error: "找不到指定部門。" }, { status: 404 });
  }
  if (storeId) {
    const store = await prisma.store.findFirst({ where: { id: storeId, isActive: true } });
    if (!store) return NextResponse.json({ error: "找不到指定門市 / 館別。" }, { status: 404 });
  }

  const content = [`交辦內容：\n${rawContent}`, `是否需要回報：${requiresReport ? "需要" : "不需要"}`].join("\n\n");

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title,
        content,
        ownerId,
        creatorId: user.id,
        departmentId,
        storeId,
        dueDate: dueDate ? new Date(`${dueDate}T23:59:59+08:00`) : null,
        priority,
        sourceType: "gm_assignment",
        status: "NOT_STARTED",
        comments: { create: { authorId: user.id, content: "建立總經理交辦任務。" } },
        attachments: { create: uploads.map((file) => ({ ...file, uploaderId: user.id })) }
      }
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "GM_TASK_CREATE",
        resourceType: "task",
        resourceId: created.id,
        metadata: JSON.stringify({ title, ownerId, departmentId, storeId, dueDate, priority, requiresReport }),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      }
    });

    await createNotification(
      {
        userId: ownerId,
        title: "總經理交辦任務",
        body: "你有一筆新的交辦任務，請進入 JU數位管理查看。",
        type: "TASK_ASSIGNED",
        priority: priority === "URGENT" ? "URGENT" : priority === "HIGH" ? "HIGH" : "MEDIUM",
        targetUrl: "/gm/tasks",
        sourceType: "task",
        sourceId: created.id,
        dedupeKey: `gm-task:${created.id}:assigned:${ownerId}`
      },
      tx
    );

    return created;
  });

  revalidateGmTaskNavigation(task.id);
  return appRedirect(`/gm/tasks?created=${task.id}`);
}
