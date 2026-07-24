import type { ChatConversation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageSystem, type CurrentUser } from "@/lib/rbac";

type ApprovalCommunicationRecord = {
  applicantId: string;
  steps?: Array<{ approverId: string | null }>;
};

type TaskCommunicationRecord = {
  ownerId: string;
  creatorId: string;
  assistants?: Array<{ userId: string }>;
};

function isGeneralManager(user: CurrentUser) {
  return user.roleKey === "GENERAL_MANAGER";
}

export function canWriteApprovalCommunication(user: CurrentUser, approval: ApprovalCommunicationRecord) {
  if (!isGeneralManager(user)) return true;
  if (approval.applicantId === user.id) return true;
  return approval.steps?.some((step) => step.approverId === user.id) ?? false;
}

export function canWriteTaskCommunication(user: CurrentUser, task: TaskCommunicationRecord) {
  if (canManageSystem(user) || isGeneralManager(user)) return true;
  if (task.ownerId === user.id || task.creatorId === user.id) return true;
  return task.assistants?.some((assistant) => assistant.userId === user.id) ?? false;
}

export async function canWriteConversationCommunication(
  user: CurrentUser,
  conversation: Pick<ChatConversation, "type" | "sourceId">
) {
  if (!conversation.sourceId) return true;

  if (conversation.type === "APPROVAL") {
    const approval = await prisma.approvalRequest.findUnique({
      where: { id: conversation.sourceId },
      select: {
        applicantId: true,
        steps: { select: { approverId: true } }
      }
    });
    return approval ? canWriteApprovalCommunication(user, approval) : false;
  }

  if (conversation.type === "TASK") {
    const task = await prisma.task.findUnique({
      where: { id: conversation.sourceId },
      select: {
        ownerId: true,
        creatorId: true,
        assistants: { select: { userId: true } }
      }
    });
    return task ? canWriteTaskCommunication(user, task) : false;
  }

  return true;
}
