DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BUDDY_REQUEST_SUBMITTED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BUDDY_REQUEST_INCOMING';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BUDDY_REQUEST_ASSIGNED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BUDDY_REQUEST_NO_MATCH';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BUDDY_REQUEST_CANCELLED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BUDDY_REQUEST_NO_LONGER_RELEVANT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BUDDY_VIDEO_REQUEST_INCOMING';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BUDDY_VIDEO_REQUEST_APPROVED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TYPE "ConversationKind" AS ENUM ('MEMBER_CHAT', 'BUDDY_SUPPORT');
CREATE TYPE "BuddyDomain" AS ENUM ('DIVORCE_SUPPORT', 'EMOTIONAL_SUPPORT', 'STARTING_OVER', 'DATING_AFTER_DIVORCE', 'BDSM_GUIDANCE', 'RELATIONSHIP_SUPPORT', 'SOMEONE_TO_TALK_TO');
CREATE TYPE "BuddySupportMode" AS ENUM ('CHAT_ONLY', 'VIDEO_OK', 'EITHER');
CREATE TYPE "BuddyAvailabilityLevel" AS ENUM ('LIGHT', 'STANDARD', 'HIGH');
CREATE TYPE "BuddyRequestStatus" AS ENUM ('PENDING', 'ASSIGNED', 'AWAITING_SEEKER_DECISION', 'CANCELLED', 'CLOSED');
CREATE TYPE "BuddyRequestAssignmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'NOT_RELEVANT');

DROP INDEX IF EXISTS "Conversation_status_updatedAt_idx";

ALTER TABLE "Conversation"
  ADD COLUMN "buddyRequestId" TEXT,
  ADD COLUMN "kind" "ConversationKind" NOT NULL DEFAULT 'MEMBER_CHAT',
  ALTER COLUMN "createdFromChatRequestId" DROP NOT NULL;

CREATE TABLE "BuddyProfile" (
  "userId" TEXT NOT NULL,
  "isAvailable" BOOLEAN NOT NULL DEFAULT false,
  "intro" TEXT,
  "availabilityLevel" "BuddyAvailabilityLevel",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BuddyProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "BuddyProfileDomain" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "domain" "BuddyDomain" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BuddyProfileDomain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BuddyRequest" (
  "id" TEXT NOT NULL,
  "seekerId" TEXT NOT NULL,
  "domain" "BuddyDomain" NOT NULL,
  "message" TEXT,
  "preferredMode" "BuddySupportMode" NOT NULL,
  "status" "BuddyRequestStatus" NOT NULL DEFAULT 'PENDING',
  "assignedBuddyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "extensionPromptAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "extendedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "BuddyRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BuddyRequestAssignment" (
  "id" TEXT NOT NULL,
  "buddyRequestId" TEXT NOT NULL,
  "buddyId" TEXT NOT NULL,
  "status" "BuddyRequestAssignmentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "BuddyRequestAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BuddyVideoConsent" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "status" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BuddyVideoConsent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BuddyProfileDomain_domain_idx" ON "BuddyProfileDomain"("domain");
CREATE UNIQUE INDEX "BuddyProfileDomain_userId_domain_key" ON "BuddyProfileDomain"("userId", "domain");
CREATE INDEX "BuddyRequest_seekerId_status_createdAt_idx" ON "BuddyRequest"("seekerId", "status", "createdAt");
CREATE INDEX "BuddyRequest_status_domain_createdAt_idx" ON "BuddyRequest"("status", "domain", "createdAt");
CREATE INDEX "BuddyRequestAssignment_buddyId_status_createdAt_idx" ON "BuddyRequestAssignment"("buddyId", "status", "createdAt");
CREATE UNIQUE INDEX "BuddyRequestAssignment_buddyRequestId_buddyId_key" ON "BuddyRequestAssignment"("buddyRequestId", "buddyId");
CREATE UNIQUE INDEX "BuddyVideoConsent_conversationId_key" ON "BuddyVideoConsent"("conversationId");
CREATE INDEX "BuddyVideoConsent_targetUserId_status_createdAt_idx" ON "BuddyVideoConsent"("targetUserId", "status", "createdAt");
CREATE INDEX "BuddyVideoConsent_requesterUserId_status_createdAt_idx" ON "BuddyVideoConsent"("requesterUserId", "status", "createdAt");
CREATE UNIQUE INDEX "Conversation_buddyRequestId_key" ON "Conversation"("buddyRequestId");
CREATE INDEX "Conversation_kind_status_updatedAt_idx" ON "Conversation"("kind", "status", "updatedAt");

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_buddyRequestId_fkey" FOREIGN KEY ("buddyRequestId") REFERENCES "BuddyRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BuddyProfile" ADD CONSTRAINT "BuddyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuddyProfileDomain" ADD CONSTRAINT "BuddyProfileDomain_userId_fkey" FOREIGN KEY ("userId") REFERENCES "BuddyProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuddyRequest" ADD CONSTRAINT "BuddyRequest_seekerId_fkey" FOREIGN KEY ("seekerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuddyRequest" ADD CONSTRAINT "BuddyRequest_assignedBuddyId_fkey" FOREIGN KEY ("assignedBuddyId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BuddyRequestAssignment" ADD CONSTRAINT "BuddyRequestAssignment_buddyRequestId_fkey" FOREIGN KEY ("buddyRequestId") REFERENCES "BuddyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuddyRequestAssignment" ADD CONSTRAINT "BuddyRequestAssignment_buddyId_fkey" FOREIGN KEY ("buddyId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuddyVideoConsent" ADD CONSTRAINT "BuddyVideoConsent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuddyVideoConsent" ADD CONSTRAINT "BuddyVideoConsent_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuddyVideoConsent" ADD CONSTRAINT "BuddyVideoConsent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuddyVideoConsent" ADD CONSTRAINT "BuddyVideoConsent_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
