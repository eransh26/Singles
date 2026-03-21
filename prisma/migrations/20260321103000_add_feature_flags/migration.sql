-- CreateEnum
CREATE TYPE "FeatureFlagRolloutType" AS ENUM ('GLOBAL', 'ADMIN_ONLY', 'USER_LIST', 'PERCENTAGE');

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "rolloutType" "FeatureFlagRolloutType" NOT NULL DEFAULT 'GLOBAL',
    "rolloutValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_enabled_rolloutType_idx" ON "FeatureFlag"("enabled", "rolloutType");
