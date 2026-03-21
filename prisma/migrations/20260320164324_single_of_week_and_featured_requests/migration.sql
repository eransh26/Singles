-- CreateEnum
CREATE TYPE "ChatRequestOriginType" AS ENUM ('STANDARD', 'SINGLE_OF_WEEK');

-- CreateEnum
CREATE TYPE "SingleOfWeekApplicationStatus" AS ENUM ('SUBMITTED', 'SHORTLISTED', 'SELECTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SingleOfWeekFeatureStatus" AS ENUM ('UPCOMING', 'AWAITING_RESPONSE', 'ACTIVE', 'DECLINED', 'HIDDEN', 'COMPLETED', 'CANCELLED');

-- DropIndex
DROP INDEX "NotificationEmailFallback_userId_status_createdAt_idx";

-- AlterTable
ALTER TABLE "ChatRequest" ADD COLUMN     "originType" "ChatRequestOriginType" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "singleOfWeekFeatureId" TEXT;

-- CreateTable
CREATE TABLE "SingleOfWeekApplication" (
    "id" TEXT NOT NULL,
    "applicantUserId" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "interests" TEXT,
    "hobbies" TEXT,
    "relationshipIntent" TEXT,
    "preferredLocation" TEXT,
    "consentedAt" TIMESTAMP(3) NOT NULL,
    "status" "SingleOfWeekApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shortlistedAt" TIMESTAMP(3),
    "selectedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "shortlistScore" INTEGER,

    CONSTRAINT "SingleOfWeekApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SingleOfWeekApplicationPhoto" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SingleOfWeekApplicationPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SingleOfWeekFeature" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "featuredUserId" TEXT NOT NULL,
    "weekOf" TIMESTAMP(3) NOT NULL,
    "publishAt" TIMESTAMP(3) NOT NULL,
    "notifyAt" TIMESTAMP(3) NOT NULL,
    "status" "SingleOfWeekFeatureStatus" NOT NULL DEFAULT 'UPCOMING',
    "selectedByAdminId" TEXT NOT NULL,
    "respondedByUserId" TEXT,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),
    "hiddenReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SingleOfWeekFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SingleOfWeekFeatureLimitOverride" (
    "featureId" TEXT NOT NULL,
    "dailyCap" INTEGER,
    "weeklyCap" INTEGER,
    "monthlyCap" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SingleOfWeekFeatureLimitOverride_pkey" PRIMARY KEY ("featureId")
);

-- CreateTable
CREATE TABLE "SingleOfWeekConfig" (
    "id" TEXT NOT NULL,
    "dailyCap" INTEGER NOT NULL DEFAULT 10,
    "weeklyCap" INTEGER NOT NULL DEFAULT 20,
    "monthlyCap" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SingleOfWeekConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SingleOfWeekView" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "viewerUserId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SingleOfWeekView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SingleOfWeekApplication_applicantUserId_status_submittedAt_idx" ON "SingleOfWeekApplication"("applicantUserId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "SingleOfWeekApplication_status_submittedAt_idx" ON "SingleOfWeekApplication"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "SingleOfWeekApplicationPhoto_applicationId_sortOrder_idx" ON "SingleOfWeekApplicationPhoto"("applicationId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SingleOfWeekFeature_weekOf_key" ON "SingleOfWeekFeature"("weekOf");

-- CreateIndex
CREATE INDEX "SingleOfWeekFeature_status_publishAt_idx" ON "SingleOfWeekFeature"("status", "publishAt");

-- CreateIndex
CREATE INDEX "SingleOfWeekFeature_featuredUserId_status_weekOf_idx" ON "SingleOfWeekFeature"("featuredUserId", "status", "weekOf");

-- CreateIndex
CREATE INDEX "SingleOfWeekView_featureId_viewedAt_idx" ON "SingleOfWeekView"("featureId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SingleOfWeekView_featureId_viewerUserId_key" ON "SingleOfWeekView"("featureId", "viewerUserId");

-- CreateIndex
CREATE INDEX "ChatRequest_singleOfWeekFeatureId_createdAt_idx" ON "ChatRequest"("singleOfWeekFeatureId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatRequest" ADD CONSTRAINT "ChatRequest_singleOfWeekFeatureId_fkey" FOREIGN KEY ("singleOfWeekFeatureId") REFERENCES "SingleOfWeekFeature"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SingleOfWeekApplication" ADD CONSTRAINT "SingleOfWeekApplication_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SingleOfWeekApplicationPhoto" ADD CONSTRAINT "SingleOfWeekApplicationPhoto_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SingleOfWeekApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SingleOfWeekFeature" ADD CONSTRAINT "SingleOfWeekFeature_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SingleOfWeekApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SingleOfWeekFeature" ADD CONSTRAINT "SingleOfWeekFeature_featuredUserId_fkey" FOREIGN KEY ("featuredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SingleOfWeekFeature" ADD CONSTRAINT "SingleOfWeekFeature_selectedByAdminId_fkey" FOREIGN KEY ("selectedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SingleOfWeekFeature" ADD CONSTRAINT "SingleOfWeekFeature_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SingleOfWeekFeatureLimitOverride" ADD CONSTRAINT "SingleOfWeekFeatureLimitOverride_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "SingleOfWeekFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SingleOfWeekView" ADD CONSTRAINT "SingleOfWeekView_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "SingleOfWeekFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SingleOfWeekView" ADD CONSTRAINT "SingleOfWeekView_viewerUserId_fkey" FOREIGN KEY ("viewerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
