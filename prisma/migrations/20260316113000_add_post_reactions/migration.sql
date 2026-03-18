CREATE TABLE "PostReaction" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PostReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostReaction_postId_userId_key" ON "PostReaction"("postId", "userId");
CREATE INDEX "PostReaction_userId_createdAt_idx" ON "PostReaction"("userId", "createdAt");

ALTER TABLE "PostReaction"
ADD CONSTRAINT "PostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostReaction"
ADD CONSTRAINT "PostReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
