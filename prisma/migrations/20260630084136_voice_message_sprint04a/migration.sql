-- CreateEnum
CREATE TYPE "ChatConversationType" AS ENUM ('DIRECT', 'DEPARTMENT', 'CROSS_DEPARTMENT', 'TASK', 'APPROVAL', 'ISSUE', 'SERVICE_REQUEST', 'ANNOUNCEMENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'VOICE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('NONE', 'PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "IssueReport" ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT;

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT;

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "type" "ChatConversationType" NOT NULL,
    "title" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "departmentId" TEXT,
    "storeId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatConversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "messageType" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceMessage" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "waveformPeaks" JSONB,
    "transcriptionText" TEXT,
    "transcriptionStatus" "TranscriptionStatus" NOT NULL DEFAULT 'NONE',
    "manualSummary" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "isWithdrawn" BOOLEAN NOT NULL DEFAULT false,
    "convertedTaskId" TEXT,
    "convertedIssueId" TEXT,
    "convertedServiceRequestId" TEXT,
    "attachedApprovalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceMessageListen" (
    "id" TEXT NOT NULL,
    "voiceMessageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastPositionSeconds" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceMessageListen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatConversation_sourceType_sourceId_idx" ON "ChatConversation"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatConversation_type_sourceType_sourceId_key" ON "ChatConversation"("type", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ChatConversationMember_userId_idx" ON "ChatConversationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatConversationMember_conversationId_userId_key" ON "ChatConversationMember"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_sourceType_sourceId_idx" ON "ChatMessage"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceMessage_messageId_key" ON "VoiceMessage"("messageId");

-- CreateIndex
CREATE INDEX "VoiceMessage_conversationId_createdAt_idx" ON "VoiceMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceMessage_sourceType_sourceId_idx" ON "VoiceMessage"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "VoiceMessageListen_userId_completedAt_idx" ON "VoiceMessageListen"("userId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceMessageListen_voiceMessageId_userId_key" ON "VoiceMessageListen"("voiceMessageId", "userId");

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversationMember" ADD CONSTRAINT "ChatConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversationMember" ADD CONSTRAINT "ChatConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceMessage" ADD CONSTRAINT "VoiceMessage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceMessage" ADD CONSTRAINT "VoiceMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceMessage" ADD CONSTRAINT "VoiceMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceMessage" ADD CONSTRAINT "VoiceMessage_convertedTaskId_fkey" FOREIGN KEY ("convertedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceMessage" ADD CONSTRAINT "VoiceMessage_convertedIssueId_fkey" FOREIGN KEY ("convertedIssueId") REFERENCES "IssueReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceMessage" ADD CONSTRAINT "VoiceMessage_convertedServiceRequestId_fkey" FOREIGN KEY ("convertedServiceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceMessage" ADD CONSTRAINT "VoiceMessage_attachedApprovalId_fkey" FOREIGN KEY ("attachedApprovalId") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceMessageListen" ADD CONSTRAINT "VoiceMessageListen_voiceMessageId_fkey" FOREIGN KEY ("voiceMessageId") REFERENCES "VoiceMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceMessageListen" ADD CONSTRAINT "VoiceMessageListen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
