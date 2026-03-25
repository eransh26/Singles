import { AccountStatus, type Prisma, TrustScoreEventType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { computeTrustScoreEvaluation, createTrustScoreChangeEventData, type TrustScoreEvaluation, type TrustScoreMetrics } from "@/lib/trust-score";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_CHAT_REQUEST_WINDOW_MS = 7 * DAY_MS;

type TrustDbClient = Prisma.TransactionClient | typeof prisma;

type TrustUserSnapshot = {
  id: string;
  accountStatus: AccountStatus;
  emailVerified: Date | null;
  phoneVerifiedAt: Date | null;
  kycVerified: boolean;
  createdAt: Date;
  trustScore: number;
  trustTier: "LOW" | "NORMAL" | "HIGH";
  activityState: { lastActiveAt: Date } | null;
};

type TrustMetricsBundle = {
  user: TrustUserSnapshot;
  metrics: TrustScoreMetrics;
};

async function collectTrustMetrics(db: TrustDbClient, userId: string, now = new Date()): Promise<TrustMetricsBundle | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      accountStatus: true,
      emailVerified: true,
      phoneVerifiedAt: true,
      kycVerified: true,
      createdAt: true,
      trustScore: true,
      trustTier: true,
      activityState: { select: { lastActiveAt: true } },
    },
  });

  if (!user) {
    return null;
  }

  const [
    activeConversationCount,
    activeReportsAgainstUser,
    rejectedProfileCount,
    hiddenProfileCount,
    rejectedSotwCount,
    hiddenSotwCount,
    hiddenPostCount,
    removedCommentCount,
    blockPairs,
    outgoingRecentChatRequestCount,
    receivedReactionCount,
    receivedReplyCount,
  ] = await Promise.all([
    db.conversation.count({
      where: {
        kind: "MEMBER_CHAT",
        status: "ACTIVE",
        OR: [{ userOneId: userId }, { userTwoId: userId }],
      },
    }),
    db.report.count({
      where: {
        targetType: "USER",
        targetUserId: userId,
        status: { in: ["OPEN", "IN_REVIEW"] },
      },
    }),
    db.userProfileImageAsset.count({ where: { userId, moderationStatus: "REJECTED" } }),
    db.userProfileImageAsset.count({ where: { userId, hiddenByModeration: true } }),
    db.singleOfWeekApplicationPhoto.count({ where: { application: { applicantUserId: userId }, moderationStatus: "REJECTED" } }),
    db.singleOfWeekApplicationPhoto.count({ where: { application: { applicantUserId: userId }, hiddenByModeration: true } }),
    db.post.count({ where: { authorUserId: userId, OR: [{ visibilityStatus: "HIDDEN" }, { moderationStatus: "REMOVED" }] } }),
    db.comment.count({ where: { authorUserId: userId, moderationStatus: "REMOVED" } }),
    db.userBlock.findMany({
      where: { OR: [{ blockerUserId: userId }, { blockedUserId: userId }] },
      select: { blockerUserId: true, blockedUserId: true },
    }),
    db.chatRequest.count({
      where: {
        fromUserId: userId,
        createdAt: { gte: new Date(now.getTime() - RECENT_CHAT_REQUEST_WINDOW_MS) },
      },
    }),
    db.postReaction.count({
      where: {
        userId: { not: userId },
        post: { authorUserId: userId },
      },
    }),
    db.comment.count({
      where: {
        authorUserId: { not: userId },
        moderationStatus: { not: "REMOVED" },
        post: { authorUserId: userId },
      },
    }),
  ]);

  const uniqueBlockCount = new Set(
    blockPairs.map((pair) => (pair.blockerUserId === userId ? pair.blockedUserId : pair.blockerUserId)),
  ).size;

  return {
    user,
    metrics: {
      accountStatus: user.accountStatus,
      emailVerified: user.emailVerified,
      phoneVerifiedAt: user.phoneVerifiedAt,
      kycVerified: user.kycVerified,
      createdAt: user.createdAt,
      lastActiveAt: user.activityState?.lastActiveAt ?? null,
      activeConversationCount,
      receivedReactionCount,
      receivedReplyCount,
      activeReportsAgainstUser,
      confirmedModerationIssueCount:
        rejectedProfileCount + hiddenProfileCount + rejectedSotwCount + hiddenSotwCount + hiddenPostCount + removedCommentCount,
      uniqueBlockCount,
      outgoingRecentChatRequestCount,
    },
  };
}

export async function recomputeUserTrustState(db: TrustDbClient, userId: string, now = new Date()) {
  const bundle = await collectTrustMetrics(db, userId, now);
  if (!bundle) {
    return null;
  }

  const evaluation = computeTrustScoreEvaluation(bundle.metrics, now);

  await db.user.update({
    where: { id: userId },
    data: {
      trustTier: evaluation.tier,
      trustScore: evaluation.score,
      trustSummary: evaluation.summary || null,
      trustUpdatedAt: now,
    },
  });

  const trustEvent = createTrustScoreChangeEventData({
    userId,
    previousScore: bundle.user.trustScore,
    nextScore: evaluation.score,
    eventType: TrustScoreEventType.RECOMPUTE,
    reason: evaluation.summary || "Signals re-evaluated.",
    metadata: {
      previousTier: bundle.user.trustTier,
      nextTier: evaluation.tier,
      previousScore: bundle.user.trustScore,
      nextScore: evaluation.score,
      nextBand: evaluation.band,
      positiveReasons: evaluation.positiveReasons,
      negativeReasons: evaluation.negativeReasons,
    },
  });

  if (trustEvent) {
    await db.trustScoreEvent.create({ data: trustEvent });
  }

  return evaluation;
}

export async function refreshUserTrustStates(db: TrustDbClient, userIds: string[], now = new Date()) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) {
    return new Map<string, TrustScoreEvaluation>();
  }

  const entries = await Promise.all(
    uniqueUserIds.map(async (userId) => [userId, await recomputeUserTrustState(db, userId, now)] as const),
  );

  return new Map(entries.filter((entry): entry is readonly [string, TrustScoreEvaluation] => Boolean(entry[1])));
}

export function formatTrustLabel(tier: string, summary?: string | null) {
  return summary ? `${tier} — ${summary}` : tier;
}
