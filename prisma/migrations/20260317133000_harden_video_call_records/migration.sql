ALTER TABLE "VideoCallRecord"
ADD COLUMN "activeConversationKey" TEXT;

CREATE UNIQUE INDEX "VideoCallRecord_activeConversationKey_key"
ON "VideoCallRecord"("activeConversationKey");
