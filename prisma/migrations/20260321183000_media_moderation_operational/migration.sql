ALTER TABLE "UserProfileImageAsset"
  ADD COLUMN "hiddenByModeration" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hiddenAt" TIMESTAMP(3),
  ADD COLUMN "hiddenReason" TEXT;

ALTER TABLE "SingleOfWeekApplicationPhoto"
  ADD COLUMN "hiddenByModeration" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hiddenAt" TIMESTAMP(3),
  ADD COLUMN "hiddenReason" TEXT;
