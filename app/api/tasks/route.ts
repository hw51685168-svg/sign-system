import { TaskPriority } from "@prisma/client";
import { NextResponse } from "next/server";
import { optionalTextValue, selectedValues, textValue } from "@/lib/form";
import { createNotification } from "@/lib/notifications";
import { revalidateGmTaskNavigation } from "@/lib/navigation-revalidate";
import { prisma } from "@/lib/prisma";
import { canAssignTasks, canViewAllBusinessData, isBranchManager, isDepartmentManager } from "@/lib/rbac";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { saveUploadedFiles } from "@/lib/uploads";
import { demoMode } from "@/lib/demo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireUser();
  if (demoMode) return appRedirect("/tasks");
  if (!canAssignTasks(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const formData = await request.formData();
  const assistantIds = selectedValues(formData, "assistantIds");
  const uploads = await saveUploadedFiles(formData, "attachments");
  const dueDate = optionalTextValue(formData, "dueDate");

  const ownerId = textValue(formData, "ownerId");
  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!owner) return NextResponse.json({ error: "找不到任務負責人。" }, { status: 400 });
  if (!canViewAllBusinessData(user) && user.roleKey !== "EXECUTIVE_ASSISTANT") {
    if (isBranchManager(user.roleKey) && owner.storeId !== user.storeId) {
      return NextResponse.json({ error: "館別主管只能指派自己館別的人員。" }, { status: 403 });
    }
    if (isDepartmentManager(user.roleKey) && owner.departmentId !== user.departmentId) {
      return NextResponse.json({ error: "部門主管只能指派自己部門的人員。" }, { status: 403 });
    }
  }
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
      title: textValue(formData, "title"),
      content: textValue(formData, "content"),
      ownerId,
      creatorId: user.id,
        departmentId: optionalTextValue(formData, "departmentId"),
        storeId: user.storeId,
      dueDate: dueDate ? new Date(`${dueDate}T23:59:59+08:00`) : null,
      priority: textValue(formData, "priority") as TaskPriority,
      assistants: {
        create: assistantIds.map((userId) => ({ userId }))
      },
      comments: {
        create: { authorId: user.id, content: "建立任務" }
      },
      attachments: {
        create: uploads.map((file) => ({ ...file, uploaderId: user.id }))
      }
      }
    });

    if (ownerId !== user.id) {
      await createNotification(
        {
          userId: ownerId,
          title: "你有新的任務",
          body: created.title,
          type: "TASK_ASSIGNED",
          priority: created.priority === "URGENT" ? "URGENT" : created.priority === "HIGH" ? "HIGH" : "MEDIUM",
          targetUrl: `/tasks/${created.id}`,
          sourceType: "task",
          sourceId: created.id,
          dedupeKey: `task:${created.id}:assigned:${ownerId}`
        },
        tx
      );
    }

    return created;
  });

  revalidateGmTaskNavigation(task.id);
  return appRedirect(`/tasks/${task.id}`);
}
