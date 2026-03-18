DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConsentStatus') THEN
    CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'REVOKED', 'CANCELED');
  END IF;
END $$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'VIDEO_REQUEST_INCOMING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'VIDEO_REQUEST_APPROVED';
ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'MESSAGE_ATTACHMENT';

ALTER TABLE "MessageAttachment"
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "Report"
ADD COLUMN IF NOT EXISTS "targetMessageAttachmentId" TEXT;

CREATE TABLE IF NOT EXISTS "VideoConsent" (
  "id" TEXT NOT NULL,
  "pairKey" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "status" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VideoConsent_pairKey_key" ON "VideoConsent"("pairKey");
CREATE INDEX IF NOT EXISTS "VideoConsent_targetUserId_status_createdAt_idx" ON "VideoConsent"("targetUserId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "VideoConsent_requesterUserId_status_createdAt_idx" ON "VideoConsent"("requesterUserId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Report_targetMessageAttachmentId_idx" ON "Report"("targetMessageAttachmentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'VideoConsent_requesterUserId_fkey'
  ) THEN
    ALTER TABLE "VideoConsent"
      ADD CONSTRAINT "VideoConsent_requesterUserId_fkey"
      FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'VideoConsent_targetUserId_fkey'
  ) THEN
    ALTER TABLE "VideoConsent"
      ADD CONSTRAINT "VideoConsent_targetUserId_fkey"
      FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'VideoConsent_approvedByUserId_fkey'
  ) THEN
    ALTER TABLE "VideoConsent"
      ADD CONSTRAINT "VideoConsent_approvedByUserId_fkey"
      FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Report_targetMessageAttachmentId_fkey'
  ) THEN
    ALTER TABLE "Report"
      ADD CONSTRAINT "Report_targetMessageAttachmentId_fkey"
      FOREIGN KEY ("targetMessageAttachmentId") REFERENCES "MessageAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
