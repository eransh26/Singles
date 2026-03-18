-- CreateEnum
CREATE TYPE "ActivityContextType" AS ENUM ('APP', 'CHAT_CONVERSATION', 'BUDDY_CONVERSATION');

-- AlterTable
ALTER TABLE "UserSettings"
  ADD COLUMN "silentModeEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hideLockScreenTextEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pushPromptDismissedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notification"
  ADD COLUMN "pushDeliveredAt" TIMESTAMP(3),
  ADD COLUMN "pushSuppressedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NotificationEmailFallback"
  ADD COLUMN "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "onlyIfUnread" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "UserActivityState" (
  "userId" TEXT NOT NULL,
  "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "contextType" "ActivityContextType" NOT NULL DEFAULT 'APP',
  "contextId" TEXT,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserActivityState_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserActivityState" ADD CONSTRAINT "UserActivityState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "UserActivityState_lastActiveAt_idx" ON "UserActivityState"("lastActiveAt");
CREATE INDEX "UserActivityState_contextType_contextId_idx" ON "UserActivityState"("contextType", "contextId");
CREATE INDEX "Notification_userId_type_createdAt_idx" ON "Notification"("userId", "type", "createdAt");
CREATE INDEX "NotificationEmailFallback_userId_status_availableAt_idx" ON "NotificationEmailFallback"("userId", "status", "availableAt");
