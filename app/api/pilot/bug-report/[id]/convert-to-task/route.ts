import { appRedirect } from "@/lib/redirect";
import { createNotification } from "@/lib/notifications";
import { canAccessPilotAdmin } from "@/lib/pilot";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canAccessPilotAdmin(user)) {
    return new Response("你沒有將 Bug 轉成修正任務的權限。", { status: 403 });
  }

  const bug = await prisma.pilotBugReport.findUnique({ where: { id: id }, include: { reporter: true } });
  if (!bug) return new Response("找不到 Bug 回報。", { status: 404 });
  if (bug.convertedTaskId) return appRedirect(`/tasks/${bug.convertedTaskId}`);

  const owner = await prisma.user.findFirst({ where: { isActive: true, role: { key: "SYSTEM_ADMIN" } }, orderBy: { createdAt: "asc" } });
  const task = await prisma.task.create({
    data: {
      title: `測試 Bug 修正：${bug.title}`,
      content: [
        `來源：主管測試問題回報`,
        `回報人：${bug.reporter.name}`,
        `角色：${bug.roleName}`,
        `發生頁面：${bug.pageUrl ?? "未填寫"}`,
        `嚴重程度：${bug.severity}`,
        `問題描述：${bug.description}`,
        bug.screenshotFileUrl ? `截圖：${bug.screenshotFileUrl}` : "截圖：未上傳"
      ].join("\n"),
      ownerId: owner?.id ?? user.id,
      creatorId: user.id,
      priority: bug.severity === "P0" ? "URGENT" : bug.severity === "P1" ? "HIGH" : "MEDIUM",
      sourceType: "pilot_bug",
      sourceId: bug.id
    }
  });

  await prisma.pilotBugReport.update({
    where: { id: bug.id },
    data: { convertedTaskId: task.id, status: "IN_PROGRESS" }
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "PILOT_BUG_CONVERT_TO_TASK",
      resourceType: "PilotBugReport",
      resourceId: bug.id,
      metadata: JSON.stringify({ taskId: task.id })
    }
  });

  if (owner?.id) {
    await createNotification({
      userId: owner.id,
      title: "測試 Bug 已轉成修正任務",
      body: task.title,
      type: "PILOT_TASK",
      priority: task.priority === "URGENT" ? "URGENT" : task.priority === "HIGH" ? "HIGH" : "MEDIUM",
      targetUrl: `/tasks/${task.id}`,
      sourceType: "task",
      sourceId: task.id,
      dedupeKey: `pilot-bug-task:${task.id}:${owner.id}`
    });
  }

  return appRedirect(`/tasks/${task.id}`);
}
