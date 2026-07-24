ALTER TABLE "ApprovalSignature"
ADD COLUMN IF NOT EXISTS "signaturePurpose" TEXT NOT NULL DEFAULT 'APPROVER';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApprovalSignature_approvalRequestId_signerId_key'
  ) THEN
    ALTER TABLE "ApprovalSignature" DROP CONSTRAINT "ApprovalSignature_approvalRequestId_signerId_key";
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalSignature_approvalRequestId_signerId_signaturePurpose_key"
ON "ApprovalSignature"("approvalRequestId", "signerId", "signaturePurpose");
