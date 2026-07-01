-- Supervisor Pilot Pack 05
-- Adds pilot checklist, feedback, and bug tracking without touching existing business data.

CREATE TYPE "PilotDeviceType" AS ENUM ('PHONE', 'DESKTOP', 'TABLET');

CREATE TYPE "PilotBugType" AS ENUM ('UI', 'PERMISSION', 'NOTIFICATION', 'VOICE', 'APPROVAL', 'TASK', 'MOBILE', 'OTHER');

CREATE TYPE "PilotSeverity" AS ENUM ('P0', 'P1', 'P2', 'P3');

CREATE TYPE "PilotStatus" AS ENUM ('OPEN', 'TRIAGED', 'IN_PROGRESS', 'DONE');

CREATE TABLE "PilotChecklistItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "roleKey" "RoleKey",
  "isCompleted" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PilotChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PilotFeedback" (
  "id" TEXT NOT NULL,
  "testerId" TEXT NOT NULL,
  "roleName" TEXT NOT NULL,
  "departmentOrStore" TEXT,
  "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deviceType" "PilotDeviceType" NOT NULL,
  "easeScore" INTEGER NOT NULL,
  "homeScore" INTEGER NOT NULL,
  "taskScore" INTEGER NOT NULL,
  "notificationScore" INTEGER NOT NULL,
  "voiceScore" INTEGER NOT NULL,
  "approvalScore" INTEGER NOT NULL,
  "stuckPoint" TEXT,
  "missingButton" TEXT,
  "smallText" TEXT,
  "badFlow" TEXT,
  "receivedPush" BOOLEAN NOT NULL DEFAULT false,
  "recordedVoice" BOOLEAN NOT NULL DEFAULT false,
  "playedVoice" BOOLEAN NOT NULL DEFAULT false,
  "hadError" BOOLEAN NOT NULL DEFAULT false,
  "suggestions" TEXT,
  "priority" "PilotSeverity" NOT NULL DEFAULT 'P2',
  "status" "PilotStatus" NOT NULL DEFAULT 'OPEN',
  "convertedTaskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PilotFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PilotBugReport" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" "PilotBugType" NOT NULL,
  "pageUrl" TEXT,
  "roleName" TEXT NOT NULL,
  "deviceType" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "screenshotFileUrl" TEXT,
  "severity" "PilotSeverity" NOT NULL,
  "blocksTesting" BOOLEAN NOT NULL DEFAULT false,
  "status" "PilotStatus" NOT NULL DEFAULT 'OPEN',
  "convertedTaskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PilotBugReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PilotChecklistItem_userId_itemKey_key" ON "PilotChecklistItem"("userId", "itemKey");
CREATE INDEX "PilotChecklistItem_userId_isCompleted_idx" ON "PilotChecklistItem"("userId", "isCompleted");
CREATE INDEX "PilotFeedback_testerId_createdAt_idx" ON "PilotFeedback"("testerId", "createdAt");
CREATE INDEX "PilotFeedback_status_priority_idx" ON "PilotFeedback"("status", "priority");
CREATE INDEX "PilotBugReport_reporterId_createdAt_idx" ON "PilotBugReport"("reporterId", "createdAt");
CREATE INDEX "PilotBugReport_severity_status_idx" ON "PilotBugReport"("severity", "status");

ALTER TABLE "PilotChecklistItem"
ADD CONSTRAINT "PilotChecklistItem_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PilotFeedback"
ADD CONSTRAINT "PilotFeedback_testerId_fkey"
FOREIGN KEY ("testerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PilotFeedback"
ADD CONSTRAINT "PilotFeedback_convertedTaskId_fkey"
FOREIGN KEY ("convertedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PilotBugReport"
ADD CONSTRAINT "PilotBugReport_reporterId_fkey"
FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PilotBugReport"
ADD CONSTRAINT "PilotBugReport_convertedTaskId_fkey"
FOREIGN KEY ("convertedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
