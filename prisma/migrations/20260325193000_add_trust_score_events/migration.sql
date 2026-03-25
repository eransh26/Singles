-- AlterTable
ALTER TABLE "User" ALTER COLUMN "trustScore" SET DEFAULT 50;
UPDATE "User" SET "trustScore" = 50 WHERE "trustScore" = 0;

-- CreateEnum
CREATE TYPE "TrustScoreEventType" AS ENUM ('RECOMPUTE', 'ADMIN_OVERRIDE');

-- CreateTable
CREATE TABLE "TrustScoreEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventType" "TrustScoreEventType" NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "sourceUserId" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrustScoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrustScoreEvent_userId_createdAt_idx" ON "TrustScoreEvent"("userId", "createdAt");
CREATE INDEX "TrustScoreEvent_eventType_createdAt_idx" ON "TrustScoreEvent"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "TrustScoreEvent" ADD CONSTRAINT "TrustScoreEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrustScoreEvent" ADD CONSTRAINT "TrustScoreEvent_sourceUserId_fkey" FOREIGN KEY ("sourceUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
