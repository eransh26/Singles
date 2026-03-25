ALTER TABLE "User"
ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "kycVerified" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "phoneVerified" = true
WHERE "phoneVerifiedAt" IS NOT NULL;
