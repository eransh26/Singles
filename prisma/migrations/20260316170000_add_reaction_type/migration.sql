CREATE TYPE "ReactionType" AS ENUM ('LOVE', 'SUPPORT', 'THUMBS_UP', 'CELEBRATE');

ALTER TABLE "PostReaction"
ADD COLUMN "reactionType" "ReactionType" NOT NULL DEFAULT 'LOVE';
