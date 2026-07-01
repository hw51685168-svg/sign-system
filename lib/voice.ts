import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { ChatConversation, Prisma } from "@prisma/client";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { sendPushForNotification } from "@/lib/push";
import {
  canAssignTasks,
  canCreateOperationalReports,
  canViewAllBusinessData,
  hasPermission,
  scopedApprovalWhere,
  scopedIssueWhere,
  scopedServiceRequestWhere,
  scopedTaskWhere,
  type CurrentUser
} from "@/lib/rbac";
import { uploadRoot } from "@/lib/uploads";

export const maxVoiceSeconds = 120;
export const maxVoiceBytes = 10 * 1024 * 1024;

export function voiceUploadRoot() {
  return path.join(uploadRoot(), "voice");
}

export function formatSeconds(seconds: number) {
  const safe = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const rest = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

export async function saveVoiceFile(file: File) {
  await mkdir(voiceUploadRoot(), { recursive: true });
  const extension = path.extname(file.name) || extensionFromMime(file.type);
  const storedFileName = `${randomUUID()}${extension}`;
  const diskPath = path.join(voiceUploadRoot(), storedFileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, buffer);
  return { storedFileName, diskPath, size: buffer.length };
}

export async function readVoiceFile(storedFileName: string) {
  const safeName = path.basename(storedFileName);
  return readFile(path.join(voiceUploadRoot(), safeName));
}

function extensionFromMime(mimeType: string) {
  if (mimeType.includes("mp4")) return ".m4a";
  if (mimeType.includes("mpeg")) return ".mp3";
  if (mimeType.includes("wav")) return ".wav";
  return ".webm";
}

export function conversationTargetUrl(conversation: Pick<ChatConversation, "type" | "sourceId" | "id">, voiceId?: string) {
  const anchor = voiceId ? `#voice-${voiceId}` : "";
  if (conversation.type === "TASK") return `/tasks/${conversation.sourceId}?tab=chat${anchor}`;
  if (conversation.type === "APPROVAL") return `/approvals/${conversation.sourceId}?tab=chat${anchor}`;
  if (conversation.type === "ISSUE") return `/issues/${conversation.sourceId}?tab=chat${anchor}`;
  if (conversation.type === "SERVICE_REQUEST") return `/services/requests/${conversation.sourceId}?tab=chat${anchor}`;
  return `/chat/conversations/${conversation.id}${anchor}`;
}

export async function getOrCreateConversation(input: {
  type: ChatConversation["type"];
  sourceType: string;
  sourceId: string;
  title: string;
  departmentId?: string | null;
  storeId?: string | null;
  createdById?: string | null;
}) {
  return prisma.chatConversation.upsert({
    where: {
      type_sourceType_sourceId: {
        type: input.type,
        sourceType: input.sourceType,
        sourceId: input.sourceId
      }
    },
    update: {
      title: input.title,
      departmentId: input.departmentId ?? undefined,
      storeId: input.storeId ?? undefined
    },
    create: {
      type: input.type,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      title: input.title,
      departmentId: input.departmentId ?? undefined,
      storeId: input.storeId ?? undefined,
      createdById: input.createdById ?? undefined
    }
  });
}

export async function assertConversationAccess(conversationId: string, user: CurrentUser) {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: { members: true }
  });
  if (!conversation) return null;
  const allowed = await canAccessConversation(conversation, user);
  return allowed ? conversation : null;
}

export async function canAccessConversation(conversation: ChatConversation & { members?: { userId: string }[] }, user: CurrentUser) {
  if (canViewAllBusinessData(user)) return true;
  if (conversation.members?.some((member) => member.userId === user.id)) return true;

  if (conversation.type === "TASK" && conversation.sourceId) {
    const count = await prisma.task.count({ where: { AND: [{ id: conversation.sourceId }, scopedTaskWhere(user)] } });
    return count > 0;
  }
  if (conversation.type === "APPROVAL" && conversation.sourceId) {
    const count = await prisma.approvalRequest.count({ where: { AND: [{ id: conversation.sourceId }, scopedApprovalWhere(user)] } });
    return count > 0;
  }
  if (conversation.type === "ISSUE" && conversation.sourceId) {
    const count = await prisma.issueReport.count({ where: { AND: [{ id: conversation.sourceId }, scopedIssueWhere(user)] } });
    return count > 0;
  }
  if (conversation.type === "SERVICE_REQUEST" && conversation.sourceId) {
    const count = await prisma.serviceRequest.count({ where: { AND: [{ id: conversation.sourceId }, scopedServiceRequestWhere(user)] } });
    return count > 0;
  }
  if (conversation.type === "DEPARTMENT") return conversation.departmentId === user.departmentId;
  return false;
}

export async function assertVoiceAccess(voiceMessageId: string, user: CurrentUser) {
  const voice = await prisma.voiceMessage.findUnique({
    where: { id: voiceMessageId },
    include: {
      sender: { include: { department: true } },
      conversation: { include: { members: true } },
      message: true,
      convertedTask: true,
      convertedIssue: true,
      convertedServiceRequest: true,
      attachedApproval: true,
      listens: true
    }
  });
  if (!voice) return null;
  const allowed = await canAccessConversation(voice.conversation, user);
  if (allowed) return voice;

  if (voice.convertedTaskId) {
    const count = await prisma.task.count({ where: { AND: [{ id: voice.convertedTaskId }, scopedTaskWhere(user)] } });
    if (count > 0) return voice;
  }
  if (voice.convertedIssueId) {
    const count = await prisma.issueReport.count({ where: { AND: [{ id: voice.convertedIssueId }, scopedIssueWhere(user)] } });
    if (count > 0) return voice;
  }
  if (voice.convertedServiceRequestId) {
    const count = await prisma.serviceRequest.count({ where: { AND: [{ id: voice.convertedServiceRequestId }, scopedServiceRequestWhere(user)] } });
    if (count > 0) return voice;
  }
  if (voice.attachedApprovalId) {
    const count = await prisma.approvalRequest.count({ where: { AND: [{ id: voice.attachedApprovalId }, scopedApprovalWhere(user)] } });
    if (count > 0) return voice;
  }

  return allowed ? voice : null;
}

export function canConvertVoiceToTask(user: CurrentUser) {
  return canAssignTasks(user) || canCreateOperationalReports(user);
}

export function canConvertVoiceToIssue(user: CurrentUser) {
  return hasPermission(user, "issue.create");
}

export function canConvertVoiceToServiceRequest(user: CurrentUser) {
  return canCreateOperationalReports(user) || hasPermission(user, "task.create") || hasPermission(user, "issue.create");
}

export function canAttachVoiceToApproval(user: CurrentUser) {
  return hasPermission(user, "approval.create") || hasPermission(user, "approval.approve");
}

export async function getConversationRecipients(conversation: ChatConversation, senderId: string) {
  const ids = new Set<string>();
  const add = (id?: string | null) => {
    if (id && id !== senderId) ids.add(id);
  };

  if (conversation.type === "TASK" && conversation.sourceId) {
    const task = await prisma.task.findUnique({
      where: { id: conversation.sourceId },
      include: { assistants: true }
    });
    add(task?.ownerId);
    add(task?.creatorId);
    task?.assistants.forEach((assistant) => add(assistant.userId));
  }

  if (conversation.type === "APPROVAL" && conversation.sourceId) {
    const approval = await prisma.approvalRequest.findUnique({
      where: { id: conversation.sourceId },
      include: { steps: true }
    });
    add(approval?.applicantId);
    approval?.steps.forEach((step) => add(step.approverId));
  }

  if (conversation.type === "ISSUE" && conversation.sourceId) {
    const issue = await prisma.issueReport.findUnique({ where: { id: conversation.sourceId } });
    add(issue?.reporterId);
    add(issue?.assigneeId);
    if (issue?.assignedDepartmentId) {
      const users = await prisma.user.findMany({ where: { isActive: true, departmentId: issue.assignedDepartmentId }, select: { id: true } });
      users.forEach((item) => add(item.id));
    }
  }

  if (conversation.type === "SERVICE_REQUEST" && conversation.sourceId) {
    const serviceRequest = await prisma.serviceRequest.findUnique({ where: { id: conversation.sourceId } });
    add(serviceRequest?.requesterId);
    add(serviceRequest?.ownerId);
    if (serviceRequest?.responsibleDepartmentId) {
      const users = await prisma.user.findMany({ where: { isActive: true, departmentId: serviceRequest.responsibleDepartmentId }, select: { id: true } });
      users.forEach((item) => add(item.id));
    }
  }

  const members = await prisma.chatConversationMember.findMany({ where: { conversationId: conversation.id }, select: { userId: true } });
  members.forEach((member) => add(member.userId));
  return Array.from(ids);
}

export async function notifyVoiceRecipients(input: {
  conversation: ChatConversation;
  voiceMessageId: string;
  senderId: string;
  senderName: string;
  priority?: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  tx?: Prisma.TransactionClient;
}) {
  const tx = input.tx ?? prisma;
  const recipients = await getConversationRecipients(input.conversation, input.senderId);
  const targetUrl = conversationTargetUrl(input.conversation, input.voiceMessageId);
  const notifications = [];
  for (const userId of recipients) {
    const notification = await createNotification(
      {
        userId,
        title: input.priority === "URGENT" ? "緊急語音通知，請立即查看" : "你收到一則語音訊息",
        body: `${input.senderName} 傳送了一則 Voice Message（語音留言）。`,
        type: "VOICE_MESSAGE",
        priority: input.priority ?? "MEDIUM",
        targetUrl,
        sourceType: "voice_message",
        sourceId: input.voiceMessageId,
        dedupeKey: `voice:${input.voiceMessageId}:to:${userId}`
      },
      tx
    );
    notifications.push(notification);
  }
  await Promise.all(notifications.map((notification) => sendPushForNotification(notification.id)));
  return notifications;
}

export async function writeVoiceAudit(input: {
  actorId?: string | null;
  action: string;
  voiceMessageId?: string | null;
  metadata?: Record<string, unknown>;
  request?: Request;
}) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? undefined,
      action: input.action,
      resourceType: "voice_message",
      resourceId: input.voiceMessageId ?? undefined,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      ipAddress: input.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? input.request?.headers.get("x-real-ip") ?? undefined,
      userAgent: input.request?.headers.get("user-agent") ?? undefined
    }
  });
}
