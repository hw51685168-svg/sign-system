import { NextResponse } from "next/server";
import { revalidateGmTaskNavigation } from "@/lib/navigation-revalidate";
import { prisma } from "@/lib/prisma";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";

function canDeleteClosedGmTask(user: { id: string; roleKey: string }, task: { creatorId: string }) {
  return ["GENERAL_MANAGER", "SYSTEM_ADMIN"].includes(user.roleKey) || task.creatorId === user.id;
}

function requestMeta(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null,
    userAgent: request.headers.get("user-agent")
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const task = await prisma.task.findFirst({
    where: { id: id, sourceType: "gm_assignment" },
    select: { id: true, title: true, status: true, creatorId: true }
  });

  if (!task) return NextResponse.json({ error: "找不到這筆交辦任務。" }, { status: 404 });
  if (!canDeleteClosedGmTask(user, task)) return NextResponse.json({ error: "你沒有刪除這筆交辦任務的權限。" }, { status: 403 });
  if (task.status !== "COMPLETED") return NextResponse.json({ error: "只有已結案交辦可以刪除。" }, { status: 409 });

  const meta = requestMeta(request);

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: {
        status: "CANCELLED",
        comments: {
          create: {
            authorId: user.id,
            content: `已刪除已結案交辦：${task.title}`
          }
        }
      }
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "GM_TASK_DELETE_CLOSED",
        resourceType: "task",
        resourceId: task.id,
        metadata: JSON.stringify({ title: task.title, previousStatus: task.status, safeDelete: true }),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      }
    });
  });

  revalidateGmTaskNavigation(task.id);
  return appRedirect("/gm/tasks?view=completed");
}
