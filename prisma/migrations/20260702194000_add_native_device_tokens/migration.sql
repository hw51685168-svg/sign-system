CREATE TABLE IF NOT EXISTS "NativeDeviceToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "deviceModel" TEXT,
  "osVersion" TEXT,
  "appVersion" TEXT,
  "userAgent" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSuccessAt" TIMESTAMP(3),
  "lastFailedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NativeDeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NativeDeviceToken_token_key" ON "NativeDeviceToken"("token");
CREATE INDEX IF NOT EXISTS "NativeDeviceToken_userId_isActive_idx" ON "NativeDeviceToken"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "NativeDeviceToken_platform_provider_isActive_idx" ON "NativeDeviceToken"("platform", "provider", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NativeDeviceToken_userId_fkey'
  ) THEN
    ALTER TABLE "NativeDeviceToken"
    ADD CONSTRAINT "NativeDeviceToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
