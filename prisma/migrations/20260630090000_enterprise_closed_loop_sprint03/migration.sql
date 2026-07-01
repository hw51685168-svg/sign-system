ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'EXECUTIVE_ASSISTANT';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'ADMIN_MANAGER';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'ACCOUNTING_MANAGER';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'DESIGN_MANAGER';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'SOCIAL_MEDIA_MANAGER';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'HR_MANAGER';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'CONSTRUCTION_MANAGER';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'BRANCH_MANAGER';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'TESTER';

DO $$ BEGIN
  CREATE TYPE "ScopeLevel" AS ENUM ('GLOBAL', 'BUSINESS_UNIT', 'DEPARTMENT', 'BRANCH', 'SELF', 'ASSIGNED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ApprovalMode" AS ENUM ('CHECKBOX', 'HANDWRITTEN', 'MIXED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationStatus" AS ENUM ('CREATED', 'SENT', 'DELIVERED', 'READ', 'CLICKED', 'FAILED', 'ESCALATED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceRequestStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'IN_PROGRESS', 'WAITING_CONFIRMATION', 'COMPLETED', 'REJECTED', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "BusinessUnit" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessUnit_name_key" ON "BusinessUnit"("name");

ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "scope" "ScopeLevel" NOT NULL DEFAULT 'ASSIGNED';
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "businessUnitId" TEXT;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "businessUnitId" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "businessUnitId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "storeId" TEXT;

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Department" ADD CONSTRAINT "Department_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Store" ADD CONSTRAINT "Store_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "ApprovalRequest" ADD COLUMN IF NOT EXISTS "approvalMode" "ApprovalMode" NOT NULL DEFAULT 'CHECKBOX';
ALTER TABLE "ApprovalRequest" ADD COLUMN IF NOT EXISTS "contentVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ApprovalLog" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "ApprovalLog" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

CREATE TABLE IF NOT EXISTS "ApprovalSignature" (
  "id" TEXT NOT NULL,
  "approvalRequestId" TEXT NOT NULL,
  "signerId" TEXT NOT NULL,
  "signatureDataUrl" TEXT NOT NULL,
  "contentSnapshot" TEXT NOT NULL,
  "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalSignature_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalSignature_approvalRequestId_signerId_key" ON "ApprovalSignature"("approvalRequestId", "signerId");
DO $$ BEGIN
  ALTER TABLE "ApprovalSignature" ADD CONSTRAINT "ApprovalSignature_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "ApprovalSignature" ADD CONSTRAINT "ApprovalSignature_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "status" "NotificationStatus" NOT NULL DEFAULT 'CREATED';
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "clickedAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "escalationLevel" INTEGER NOT NULL DEFAULT 0;
UPDATE "Notification" SET "status" = CASE WHEN "isRead" THEN 'READ'::"NotificationStatus" ELSE 'SENT'::"NotificationStatus" END WHERE "status" = 'CREATED';

ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "browser" TEXT;
ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "os" TEXT;
ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "lastSuccessAt" TIMESTAMP(3);
ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "lastFailedAt" TIMESTAMP(3);

ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "enableBadge" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "notifyP0" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "notifyP1" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "notifyP2" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "notifyP3" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "allowEscalationOverride" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "responsePayload" TEXT;

CREATE TABLE IF NOT EXISTS "NotificationEscalation" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "fromUserId" TEXT,
  "toUserId" TEXT NOT NULL,
  "escalationReason" TEXT NOT NULL,
  "escalatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'created',
  CONSTRAINT "NotificationEscalation_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "NotificationEscalation" ADD CONSTRAINT "NotificationEscalation_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "NotificationEscalation" ADD CONSTRAINT "NotificationEscalation_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "NotificationEscalation" ADD CONSTRAINT "NotificationEscalation_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ServiceRequest" (
  "id" TEXT NOT NULL,
  "requestNo" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "requesterDepartmentId" TEXT,
  "businessUnitId" TEXT,
  "responsibleDepartmentId" TEXT,
  "storeId" TEXT,
  "ownerId" TEXT,
  "dueDate" TIMESTAMP(3),
  "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "content" TEXT NOT NULL,
  "status" "ServiceRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceRequest_requestNo_key" ON "ServiceRequest"("requestNo");
DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_requesterDepartmentId_fkey" FOREIGN KEY ("requesterDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_responsibleDepartmentId_fkey" FOREIGN KEY ("responsibleDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ServiceRequestDepartment" (
  "id" TEXT NOT NULL,
  "serviceRequestId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  CONSTRAINT "ServiceRequestDepartment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceRequestDepartment_serviceRequestId_departmentId_key" ON "ServiceRequestDepartment"("serviceRequestId", "departmentId");
DO $$ BEGIN
  ALTER TABLE "ServiceRequestDepartment" ADD CONSTRAINT "ServiceRequestDepartment_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ServiceRequestDepartment" ADD CONSTRAINT "ServiceRequestDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ServiceRequestAssistant" (
  "id" TEXT NOT NULL,
  "serviceRequestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "ServiceRequestAssistant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceRequestAssistant_serviceRequestId_userId_key" ON "ServiceRequestAssistant"("serviceRequestId", "userId");
DO $$ BEGIN
  ALTER TABLE "ServiceRequestAssistant" ADD CONSTRAINT "ServiceRequestAssistant_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ServiceRequestAssistant" ADD CONSTRAINT "ServiceRequestAssistant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ServiceRequestLog" (
  "id" TEXT NOT NULL,
  "serviceRequestId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceRequestLog_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "ServiceRequestLog" ADD CONSTRAINT "ServiceRequestLog_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ServiceRequestLog" ADD CONSTRAINT "ServiceRequestLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "serviceRequestId" TEXT;
DO $$ BEGIN
  ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT,
  "metadata" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AuditLog_resourceType_resourceId_idx" ON "AuditLog"("resourceType", "resourceId");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
