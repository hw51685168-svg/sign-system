import { IssueSeverity, IssueType } from "@prisma/client";
import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { sendPushForNotification } from "@/lib/push";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { assertVoiceAccess, canConvertVoiceToIssue, writeVoiceAudit } from "@/lib/voice";

export async function POST(request: Request, { params }: { params: { voiceMessageId: string } }) {
  const user = await requireUser();
  const voice = await assertVoiceAccess(params.voiceMessageId, user);
  if (!voice) return NextResponse.json({ error: "找不到語音或沒有權限。" }, { status: 404 });
  if (!canConvertVoiceToIssue(user)) return NextResponse.json({ error: "沒有語音轉問題回報權限。" }, { status: 403 });

  const formData = await request.formData();
  const type = (optionalTextValue(formData, "type") || "OTHER") as IssueType;
  const severity = (optionalTextValue(formData, "severity") || "MEDIUM") as IssueSeverity;
  const title = optionalTextValue(formData, "title");
  const assignedDepartmentId = optionalTextValue(formData, "assignedDepartmentId") || user.departmentId;
  const storeId = optionalTextValue(formData, "storeId") || user.storeId;

  const issue = await prisma.$transaction(async (tx) => {
    const created = await tx.issueReport.create({
      data: {
        storeId,
        reporterId: user.id,
        type,
        description: [
          title || voice.manualSummary || "此問題由 Voice Message（語音留言）轉成。",
          `來源語音：${voice.id}`,
          `語音長度：${voice.durationSeconds} 秒`
        ].join("\n"),
        occurredAt: new Date(),
        severity,
        assignedDepartmentId,
        sourceType: "voice_message",
        sourceId: voice.id,
        logs: { create: { actorId: user.id, toStatus: "OPEN", comment: "由語音留言轉成問題回報" } }
      }
    });
    await tx.voiceMessage.update({ where: { id: voice.id }, data: { convertedIssueId: created.id } });
    await tx.chatMessage.create({
      data: {
        conversationId: voice.conversationId,
        senderId: user.id,
        messageType: "SYSTEM",
        content: `此語音已轉成問題回報：${created.id}`,
        sourceType: "issue",
        sourceId: created.id
      }
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "VOICE_CONVERT_TO_ISSUE",
        resourceType: "voice_message",
        resourceId: voice.id,
        metadata: JSON.stringify({ issueId: created.id })
      }
    });
    return created;
  });

  if (issue.assignedDepartmentId) {
    const receivers = await prisma.user.findMany({ where: { isActive: true, departmentId: issue.assignedDepartmentId }, select: { id: true } });
    await Promise.all(
      receivers
        .filter((receiver) => receiver.id !== user.id)
        .map(async (receiver) => {
          const notification = await createNotification({
            userId: receiver.id,
            title: "語音已轉成問題回報",
            body: title || voice.manualSummary || "請查看問題回報。",
            type: "ISSUE_CREATED",
            priority: severity === "CRITICAL" ? "URGENT" : severity === "HIGH" ? "HIGH" : "MEDIUM",
            targetUrl: `/issues/${issue.id}?tab=chat`,
            sourceType: "voice_message",
            sourceId: voice.id,
            dedupeKey: `voice:${voice.id}:issue:${issue.id}:dept:${receiver.id}`
          });
          await sendPushForNotification(notification.id);
        })
    );
  }
  await writeVoiceAudit({ actorId: user.id, action: "VOICE_CONVERT_TO_ISSUE_API", voiceMessageId: voice.id, request });
  return appRedirect(`/issues/${issue.id}?tab=chat`);
}
