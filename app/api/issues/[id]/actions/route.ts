import { IssueStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { canViewAllBusinessData, hasPermission, isDepartmentManager, scopedIssueWhere } from "@/lib/rbac";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const formData = await request.formData();
  const action = textValue(formData, "action");
  const comment = optionalTextValue(formData, "comment");
  const requestedStatus = optionalTextValue(formData, "status") as IssueStatus | null;
  const assignedDepartmentId = optionalTextValue(formData, "assignedDepartmentId");
  const assigneeId = optionalTextValue(formData, "assigneeId");

  const issue = await prisma.issueReport.findFirst({
    where: { AND: [{ id: id }, scopedIssueWhere(user)] },
    include: { reporter: true, assignee: true, assignedDepartment: true }
  });
  if (!issue) return NextResponse.json({ error: "找不到問題回報。" }, { status: 404 });

  const canManage =
    canViewAllBusinessData(user) ||
    hasPermission(user, "issue.assign") ||
    hasPermission(user, "issue.close") ||
    issue.assigneeId === user.id ||
    (isDepartmentManager(user.roleKey) && issue.assignedDepartmentId === user.departmentId);

  if (action === "COMMENT") {
    if (!comment) return NextResponse.json({ error: "留言內容不可空白。" }, { status: 400 });
    await prisma.issueLog.create({ data: { issueReportId: issue.id, actorId: user.id, comment } });
    return appRedirect(`/issues/${issue.id}`);
  }

  if (!canManage) return NextResponse.json({ error: "權限不足，無法更新此問題回報。" }, { status: 403 });
  if (!requestedStatus || !Object.values(IssueStatus).includes(requestedStatus)) {
    return NextResponse.json({ error: "問題狀態不正確。" }, { status: 400 });
  }
  if (requestedStatus === "CLOSED" && !comment) {
    return NextResponse.json({ error: "結案必須填寫處理結果。" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const nextAssignedDepartmentId = assignedDepartmentId ?? issue.assignedDepartmentId;
    await tx.issueReport.update({
      where: { id: issue.id },
      data: {
        status: requestedStatus,
        assignedDepartmentId: nextAssignedDepartmentId,
        assigneeId: assigneeId ?? issue.assigneeId,
        closureNote: requestedStatus === "CLOSED" ? comment : issue.closureNote
      }
    });
    await tx.issueLog.create({
      data: {
        issueReportId: issue.id,
        actorId: user.id,
        fromStatus: issue.status,
        toStatus: requestedStatus,
        comment: [
          comment,
          assignedDepartmentId && assignedDepartmentId !== issue.assignedDepartmentId ? "已更新指派處理部門" : null,
          assigneeId && assigneeId !== issue.assigneeId ? "已更新處理人" : null
        ].filter(Boolean).join("\n") || "更新問題狀態"
      }
    });

    const notifyIds = Array.from(new Set([issue.reporterId, issue.assigneeId, assigneeId].filter((id): id is string => Boolean(id) && id !== user.id)));
    await Promise.all(
      notifyIds.map((userId) =>
        createNotification(
          {
            userId,
            title: "問題回報已更新",
            body: issue.description.slice(0, 80),
            type: "ISSUE_STATUS",
            priority: issue.severity === "CRITICAL" ? "URGENT" : issue.severity === "HIGH" ? "HIGH" : "MEDIUM",
            targetUrl: `/issues/${issue.id}`,
            sourceType: "issue",
            sourceId: issue.id,
            dedupeKey: `issue:${issue.id}:status:${requestedStatus}:${user.id}:${Date.now()}`
          },
          tx
        )
      )
    );
  });

  return appRedirect(`/issues/${issue.id}`);
}
