ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "lastFailureReason" TEXT;

CREATE INDEX IF NOT EXISTS "PushSubscription_platform_isActive_idx" ON "PushSubscription"("platform", "isActive");
