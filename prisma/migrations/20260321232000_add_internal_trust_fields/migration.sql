CREATE TYPE "InternalTrustTier" AS ENUM ('LOW', 'NORMAL', 'HIGH');

ALTER TABLE "User"
ADD COLUMN "trustTier" "InternalTrustTier" NOT NULL DEFAULT 'LOW',
ADD COLUMN "trustScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "trustSummary" TEXT,
ADD COLUMN "trustUpdatedAt" TIMESTAMP(3);
