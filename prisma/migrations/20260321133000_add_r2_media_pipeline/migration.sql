CREATE TYPE "MediaStorageProvider" AS ENUM ('LEGACY_INLINE', 'R2');
CREATE TYPE "MediaModerationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

CREATE TABLE "UserProfileImageAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "storageProvider" "MediaStorageProvider" NOT NULL DEFAULT 'R2',
    "mimeType" TEXT NOT NULL,
    "moderationStatus" "MediaModerationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "moderationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfileImageAsset_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SingleOfWeekApplicationPhoto"
    ADD COLUMN "storageProvider" "MediaStorageProvider" NOT NULL DEFAULT 'LEGACY_INLINE',
    ADD COLUMN "mimeType" TEXT,
    ADD COLUMN "moderationStatus" "MediaModerationStatus" NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "reviewedAt" TIMESTAMP(3),
    ADD COLUMN "moderationNote" TEXT;

CREATE INDEX "UserProfileImageAsset_userId_moderationStatus_uploadedAt_idx" ON "UserProfileImageAsset"("userId", "moderationStatus", "uploadedAt");

ALTER TABLE "UserProfileImageAsset" ADD CONSTRAINT "UserProfileImageAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
