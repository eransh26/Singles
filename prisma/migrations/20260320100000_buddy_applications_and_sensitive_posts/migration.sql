-- CreateEnum
CREATE TYPE "PostSensitivityStatus" AS ENUM ('NORMAL', 'SELF_MARKED_SENSITIVE', 'SYSTEM_SENSITIVE');

-- CreateEnum
CREATE TYPE "BuddyApplicationStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BuddyApplicationDomainStatus" AS ENUM ('PENDING_RECOMMENDATIONS', 'REPLACEMENT_NEEDED', 'PENDING_ADMIN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BuddyRecommendationStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "BuddyDomainRecord" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BuddyDomainRecord_pkey" PRIMARY KEY ("id")
);

-- Seed default Buddy domains for history-preserving migration
INSERT INTO "BuddyDomainRecord" ("id", "slug", "name", "isActive", "sortOrder", "createdAt", "updatedAt") VALUES
  ('buddy-domain-divorce-support', 'divorce-support', 'Divorce support', true, 0, NOW(), NOW()),
  ('buddy-domain-emotional-support', 'emotional-support', 'Emotional support', true, 1, NOW(), NOW()),
  ('buddy-domain-starting-over', 'starting-over', 'Starting over / rebuilding life', true, 2, NOW(), NOW()),
  ('buddy-domain-dating-after-divorce', 'dating-after-divorce', 'Dating after divorce', true, 3, NOW(), NOW()),
  ('buddy-domain-bdsm-guidance', 'bdsm-guidance', 'BDSM lifestyle guidance', true, 4, NOW(), NOW()),
  ('buddy-domain-relationship-support', 'relationship-support', 'Relationship support', true, 5, NOW(), NOW()),
  ('buddy-domain-someone-to-talk-to', 'someone-to-talk-to', 'Someone to talk to', true, 6, NOW(), NOW());

-- CreateTable
CREATE TABLE "BuddyApplication" (
    "id" TEXT NOT NULL,
    "applicantUserId" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "availabilityLevel" "BuddyAvailabilityLevel" NOT NULL,
    "status" "BuddyApplicationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "BuddyApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuddyApplicationDomain" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "status" "BuddyApplicationDomainStatus" NOT NULL DEFAULT 'PENDING_RECOMMENDATIONS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adminReviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "approvedByAdminId" TEXT,
    "rejectedByAdminId" TEXT,
    CONSTRAINT "BuddyApplicationDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuddyApplicationRecommendation" (
    "id" TEXT NOT NULL,
    "applicationDomainId" TEXT NOT NULL,
    "recommenderUserId" TEXT NOT NULL,
    "status" "BuddyRecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "replacedAt" TIMESTAMP(3),
    CONSTRAINT "BuddyApplicationRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuddyReapplicationOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "grantedByAdminId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BuddyReapplicationOverride_pkey" PRIMARY KEY ("id")
);

-- Alter existing Buddy tables while preserving history
ALTER TABLE "BuddyProfileDomain"
  ADD COLUMN "approvedApplicationDomainId" TEXT,
  ADD COLUMN "domainId" TEXT;

ALTER TABLE "BuddyRequest"
  ADD COLUMN "domainId" TEXT;

ALTER TABLE "Post"
  ADD COLUMN "sensitivityStatus" "PostSensitivityStatus" NOT NULL DEFAULT 'NORMAL';

ALTER TABLE "UserActivityState" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Backfill old enum domains into the new BuddyDomainRecord table
UPDATE "BuddyProfileDomain" AS bpd
SET "domainId" = bdr."id"
FROM "BuddyDomainRecord" AS bdr
WHERE bpd."domainId" IS NULL
  AND bdr."slug" = CASE bpd."domain"
    WHEN 'DIVORCE_SUPPORT' THEN 'divorce-support'
    WHEN 'EMOTIONAL_SUPPORT' THEN 'emotional-support'
    WHEN 'STARTING_OVER' THEN 'starting-over'
    WHEN 'DATING_AFTER_DIVORCE' THEN 'dating-after-divorce'
    WHEN 'BDSM_GUIDANCE' THEN 'bdsm-guidance'
    WHEN 'RELATIONSHIP_SUPPORT' THEN 'relationship-support'
    WHEN 'SOMEONE_TO_TALK_TO' THEN 'someone-to-talk-to'
  END;

UPDATE "BuddyRequest" AS br
SET "domainId" = bdr."id"
FROM "BuddyDomainRecord" AS bdr
WHERE br."domainId" IS NULL
  AND bdr."slug" = CASE br."domain"
    WHEN 'DIVORCE_SUPPORT' THEN 'divorce-support'
    WHEN 'EMOTIONAL_SUPPORT' THEN 'emotional-support'
    WHEN 'STARTING_OVER' THEN 'starting-over'
    WHEN 'DATING_AFTER_DIVORCE' THEN 'dating-after-divorce'
    WHEN 'BDSM_GUIDANCE' THEN 'bdsm-guidance'
    WHEN 'RELATIONSHIP_SUPPORT' THEN 'relationship-support'
    WHEN 'SOMEONE_TO_TALK_TO' THEN 'someone-to-talk-to'
  END;

ALTER TABLE "BuddyProfileDomain"
  ALTER COLUMN "domainId" SET NOT NULL;

ALTER TABLE "BuddyRequest"
  ALTER COLUMN "domainId" SET NOT NULL;

-- Remove enum-based indexes before dropping legacy columns
DROP INDEX IF EXISTS "BuddyProfileDomain_domain_idx";
DROP INDEX IF EXISTS "BuddyProfileDomain_userId_domain_key";
DROP INDEX IF EXISTS "BuddyRequest_status_domain_createdAt_idx";

ALTER TABLE "BuddyProfileDomain" DROP COLUMN "domain";
ALTER TABLE "BuddyRequest" DROP COLUMN "domain";

DROP TYPE "BuddyDomain";

-- New indexes
CREATE UNIQUE INDEX "BuddyDomainRecord_slug_key" ON "BuddyDomainRecord"("slug");
CREATE UNIQUE INDEX "BuddyDomainRecord_name_key" ON "BuddyDomainRecord"("name");
CREATE INDEX "BuddyDomainRecord_isActive_sortOrder_idx" ON "BuddyDomainRecord"("isActive", "sortOrder");
CREATE INDEX "BuddyApplication_applicantUserId_status_createdAt_idx" ON "BuddyApplication"("applicantUserId", "status", "createdAt");
CREATE INDEX "BuddyApplicationDomain_status_createdAt_idx" ON "BuddyApplicationDomain"("status", "createdAt");
CREATE UNIQUE INDEX "BuddyApplicationDomain_applicationId_domainId_key" ON "BuddyApplicationDomain"("applicationId", "domainId");
CREATE INDEX "BuddyApplicationRecommendation_recommenderUserId_status_cre_idx" ON "BuddyApplicationRecommendation"("recommenderUserId", "status", "createdAt");
CREATE INDEX "BuddyApplicationRecommendation_applicationDomainId_replaced_idx" ON "BuddyApplicationRecommendation"("applicationDomainId", "replacedAt");
CREATE UNIQUE INDEX "BuddyReapplicationOverride_userId_domainId_key" ON "BuddyReapplicationOverride"("userId", "domainId");
CREATE UNIQUE INDEX "BuddyProfileDomain_approvedApplicationDomainId_key" ON "BuddyProfileDomain"("approvedApplicationDomainId");
CREATE INDEX "BuddyProfileDomain_domainId_idx" ON "BuddyProfileDomain"("domainId");
CREATE UNIQUE INDEX "BuddyProfileDomain_userId_domainId_key" ON "BuddyProfileDomain"("userId", "domainId");
CREATE INDEX "BuddyRequest_status_domainId_createdAt_idx" ON "BuddyRequest"("status", "domainId", "createdAt");

-- Foreign keys
ALTER TABLE "BuddyProfileDomain" ADD CONSTRAINT "BuddyProfileDomain_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "BuddyDomainRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BuddyProfileDomain" ADD CONSTRAINT "BuddyProfileDomain_approvedApplicationDomainId_fkey" FOREIGN KEY ("approvedApplicationDomainId") REFERENCES "BuddyApplicationDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BuddyApplication" ADD CONSTRAINT "BuddyApplication_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuddyApplicationDomain" ADD CONSTRAINT "BuddyApplicationDomain_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "BuddyApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuddyApplicationDomain" ADD CONSTRAINT "BuddyApplicationDomain_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "BuddyDomainRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BuddyApplicationDomain" ADD CONSTRAINT "BuddyApplicationDomain_approvedByAdminId_fkey" FOREIGN KEY ("approvedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BuddyApplicationDomain" ADD CONSTRAINT "BuddyApplicationDomain_rejectedByAdminId_fkey" FOREIGN KEY ("rejectedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BuddyApplicationRecommendation" ADD CONSTRAINT "BuddyApplicationRecommendation_applicationDomainId_fkey" FOREIGN KEY ("applicationDomainId") REFERENCES "BuddyApplicationDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuddyApplicationRecommendation" ADD CONSTRAINT "BuddyApplicationRecommendation_recommenderUserId_fkey" FOREIGN KEY ("recommenderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuddyReapplicationOverride" ADD CONSTRAINT "BuddyReapplicationOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuddyReapplicationOverride" ADD CONSTRAINT "BuddyReapplicationOverride_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "BuddyDomainRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuddyReapplicationOverride" ADD CONSTRAINT "BuddyReapplicationOverride_grantedByAdminId_fkey" FOREIGN KEY ("grantedByAdminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuddyRequest" ADD CONSTRAINT "BuddyRequest_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "BuddyDomainRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
