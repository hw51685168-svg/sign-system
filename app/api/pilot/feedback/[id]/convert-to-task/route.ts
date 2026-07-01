import { appRedirect } from "@/lib/redirect";
import { createNotification } from "@/lib/notifications";
import { canAccessPilotAdmin } from "@/lib/pilot";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!canAccessPilotAdmin(user)) {
    return new Response("你沒有將回饋轉成任務的權限。", { status: 403 });
  }

  const feedback = await prisma.pilotFeedback.findUnique({ where: { id: params.id }, include: { tester: true } });
  if (!feedback) return new Response("找不到回饋紀錄。", { status: 404 });
  if (feedback.convertedTaskId) return appRedirect(`/tasks/${feedback.convertedTaskId}`);

  const owner = await prisma.user.findFirst({ where: { isActive: true, role: { key: "SYSTEM_ADMIN" } }, orderBy: { createdAt: "asc" } });
  const task = await prisma.task.create({
    data: {
      title: `主管回饋改善：${feedback.tester.name}`,
      content: [
        `來源：主管實測回饋`,
        `測試人：${feedback.tester.name}`,
        `角色：${feedback.roleName}`,
        `最卡的地方：${feedback.stuckPoint ?? "未填寫"}`,
        `找不到的按鈕：${feedback.missingButton ?? "未填寫"}`,
        `建議修改：${feedback.suggestions ?? "未填寫"}`
      ].join("\n"),
      ownerId: owner?.id ?? user.id,
      creatorId: user.id,
      priority: feedback.priority === "P0" ? "URGENT" : feedback.priority === "P1" ? "HIGH" : "MEDIUM",
      sourceType: "pilot_feedback",
      sourceId: feedback.id
    }
  });

  await prisma.pilotFeedback.update({
    where: { id: feedback.id },
    data: { convertedTaskId: task.id, status: "IN_PROGRESS" }
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "PILOT_FEEDBACK_CONVERT_TO_TASK",
      resourceType: "PilotFeedback",
      resourceId: feedback.id,
      metadata: JSON.stringify({ taskId: task.id })
    }
  });

  if (owner?.id) {
    await createNotification({
      userId: owner.id,
      title: "主管回饋已轉成改善任務",
      body: task.title,
      type: "PILOT_TASK",
      priority: task.priority === "URGENT" ? "URGENT" : task.priority === "HIGH" ? "HIGH" : "MEDIUM",
      targetUrl: `/tasks/${task.id}`,
      sourceType: "task",
      sourceId: task.id,
      dedupeKey: `pilot-feedback-task:${task.id}:${owner.id}`
    });
  }

  return appRedirect(`/tasks/${task.id}`);
}
