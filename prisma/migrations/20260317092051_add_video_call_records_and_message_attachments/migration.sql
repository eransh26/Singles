-- CreateEnum
CREATE TYPE "MessageAttachmentKind" AS ENUM ('IMAGE', 'FILE');

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "kind" "MessageAttachmentKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoCallRecord" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "startedByUserId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "lastJoinedAt" TIMESTAMP(3),

    CONSTRAINT "VideoCallRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_createdAt_idx" ON "MessageAttachment"("messageId", "createdAt");

-- CreateIndex
CREATE INDEX "VideoCallRecord_conversationId_startedAt_idx" ON "VideoCallRecord"("conversationId", "startedAt");

-- CreateIndex
CREATE INDEX "VideoCallRecord_roomName_endedAt_idx" ON "VideoCallRecord"("roomName", "endedAt");

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoCallRecord" ADD CONSTRAINT "VideoCallRecord_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoCallRecord" ADD CONSTRAINT "VideoCallRecord_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
