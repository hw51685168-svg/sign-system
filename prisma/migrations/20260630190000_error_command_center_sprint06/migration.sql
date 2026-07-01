-- Error Command Center + Codex Auto Repair Intake Sprint 06
-- Adds sanitized error reports, breadcrumbs, Codex repair requests, and error attachments.

CREATE TYPE "ErrorSeverity" AS ENUM ('P0', 'P1', 'P2', 'P3');

CREATE TYPE "ErrorReportStatus" AS ENUM ('OPEN', 'TRIAGED', 'CODEX_REQUESTED', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'CLOSED', 'IGNORED');

CREATE TYPE "CodexFixRequestStatus" AS ENUM ('DRAFT', 'READY', 'SENT_TO_CODEX', 'GITHUB_ISSUE_CREATED', 'IN_PROGRESS', 'FIX_PROPOSED', 'FIXED', 'VERIFIED', 'CLOSED', 'REJECTED');

CREATE TABLE "ErrorReport" (
  "id" TEXT NOT NULL,
  "severity" "ErrorSeverity" NOT NULL DEFAULT 'P2',
  "status" "ErrorReportStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "module" TEXT,
  "route" TEXT,
  "action" TEXT,
  "userId" TEXT,
  "userRole" TEXT,
  "departmentId" TEXT,
  "branchId" TEXT,
  "businessUnitId" TEXT,
  "deviceType" TEXT,
  "browser" TEXT,
  "os" TEXT,
  "userAgent" TEXT,
  "appVersion" TEXT,
  "commitHash" TEXT,
  "requestId" TEXT,
  "sessionId" TEXT,
  "stackTraceSanitized" TEXT,
  "breadcrumbsJson" TEXT,
  "contextJsonSanitized" TEXT,
  "fingerprint" TEXT NOT NULL,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isResolved" BOOLEAN NOT NULL DEFAULT false,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "codexFixRequestId" TEXT,
  "githubIssueUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ErrorReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ErrorBreadcrumb" (
  "id" TEXT NOT NULL,
  "errorReportId" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "route" TEXT,
  "metadataJsonSanitized" TEXT,

  CONSTRAINT "ErrorBreadcrumb_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CodexFixRequest" (
  "id" TEXT NOT NULL,
  "errorReportId" TEXT NOT NULL,
  "severity" "ErrorSeverity" NOT NULL,
  "title" TEXT NOT NULL,
  "codexPrompt" TEXT NOT NULL,
  "sanitizedContextJson" TEXT,
  "suspectedFilesJson" TEXT,
  "reproductionSteps" TEXT,
  "acceptanceCriteria" TEXT,
  "status" "CodexFixRequestStatus" NOT NULL DEFAULT 'READY',
  "createdByUserId" TEXT,
  "sentToCodexAt" TIMESTAMP(3),
  "githubIssueUrl" TEXT,
  "githubIssueNumber" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CodexFixRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ErrorAttachment" (
  "id" TEXT NOT NULL,
  "errorReportId" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "isScreenshot" BOOLEAN NOT NULL DEFAULT false,
  "isSanitized" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ErrorAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ErrorReport_fingerprint_key" ON "ErrorReport"("fingerprint");
CREATE INDEX "ErrorReport_severity_status_lastSeenAt_idx" ON "ErrorReport"("severity", "status", "lastSeenAt");
CREATE INDEX "ErrorReport_route_module_idx" ON "ErrorReport"("route", "module");
CREATE INDEX "ErrorReport_userId_lastSeenAt_idx" ON "ErrorReport"("userId", "lastSeenAt");
CREATE INDEX "ErrorBreadcrumb_errorReportId_timestamp_idx" ON "ErrorBreadcrumb"("errorReportId", "timestamp");
CREATE UNIQUE INDEX "CodexFixRequest_errorReportId_key" ON "CodexFixRequest"("errorReportId");
CREATE INDEX "CodexFixRequest_severity_status_createdAt_idx" ON "CodexFixRequest"("severity", "status", "createdAt");
CREATE INDEX "ErrorAttachment_errorReportId_idx" ON "ErrorAttachment"("errorReportId");

ALTER TABLE "ErrorReport"
ADD CONSTRAINT "ErrorReport_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ErrorReport"
ADD CONSTRAINT "ErrorReport_resolvedByUserId_fkey"
FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ErrorBreadcrumb"
ADD CONSTRAINT "ErrorBreadcrumb_errorReportId_fkey"
FOREIGN KEY ("errorReportId") REFERENCES "ErrorReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CodexFixRequest"
ADD CONSTRAINT "CodexFixRequest_errorReportId_fkey"
FOREIGN KEY ("errorReportId") REFERENCES "ErrorReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CodexFixRequest"
ADD CONSTRAINT "CodexFixRequest_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ErrorAttachment"
ADD CONSTRAINT "ErrorAttachment_errorReportId_fkey"
FOREIGN KEY ("errorReportId") REFERENCES "ErrorReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
