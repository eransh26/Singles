import { AccountStatus, InternalTrustTier, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_ACTIVITY_WINDOW_MS = 14 * DAY_MS;
const MATURE_ACCOUNT_WINDOW_MS = 30 * DAY_MS;
const VERY_MATURE_ACCOUNT_WINDOW_MS = 90 * DAY_MS;
const RECENT_CHAT_REQUEST_WINDOW_MS = 7 * DAY_MS;

export type InternalTrustEvaluation = {
  tier: InternalTrustTier;
  score: number;
  summary: string;
  positiveReasons: string[];
  negativeReasons: string[];
};

type TrustMetrics = {
  accountStatus: AccountStatus;
  emailVerified: Date | null;
  phoneVerifiedAt: Date | null;
  createdAt: Date;
  lastActiveAt: Date | null;
  activeConversationCount: number;
  activeReportsAgainstUser: number;
  rejectedOrHiddenMediaCount: number;
  blockInvolvementCount: number;
  outgoingRecentChatRequestCount: number;
};

type TrustDbClient = Prisma.TransactionClient | typeof prisma;

function summarizeTrustReasons(positiveReasons: string[], negativeReasons: string[]) {
  const headline = negativeReasons.length > 0 ? negativeReasons.slice(0, 2) : positiveReasons.slice(0, 3);
  return headline.join(", ");
}

export function evaluateInternalTrust(metrics: TrustMetrics, now = new Date()): InternalTrustEvaluation {
  let score = 0;
  const positiveReasons: string[] = [];
  const negativeReasons: string[] = [];

  if (metrics.accountStatus !== AccountStatus.ACTIVE) {
    return {
      tier: InternalTrustTier.LOW,
      score: -10,
      summary: "Inactive account status",
      positiveReasons,
      negativeReasons: ["inactive account"],
    };
  }

  if (metrics.emailVerified) {
    score += 2;
    positiveReasons.push("verified email");
  }

  if (metrics.phoneVerifiedAt) {
    score += 2;
    positiveReasons.push("verified phone");
  }

  const accountAgeMs = now.getTime() - metrics.createdAt.getTime();
  if (accountAgeMs >= VERY_MATURE_ACCOUNT_WINDOW_MS) {
    score += 2;
    positiveReasons.push("mature account");
  } else if (accountAgeMs >= MATURE_ACCOUNT_WINDOW_MS) {
    score += 1;
    positiveReasons.push("established account");
  }

  if (metrics.lastActiveAt && now.getTime() - metrics.lastActiveAt.getTime() <= RECENT_ACTIVITY_WINDOW_MS) {
    score += 1;
    positiveReasons.push("recent activity");
  }

  if (metrics.activeConversationCount >= 5) {
    score += 2;
    positiveReasons.push("healthy chat history");
  } else if (metrics.activeConversationCount >= 1) {
    score += 1;
    positiveReasons.push("approved chat history");
  }

  if (metrics.activeReportsAgainstUser >= 3) {
    score -= 4;
    negativeReasons.push("multiple unresolved reports");
  } else if (metrics.activeReportsAgainstUser >= 1) {
    score -= 1;
    negativeReasons.push("active report under review");
  }

  if (metrics.rejectedOrHiddenMediaCount >= 3) {
    score -= 3;
    negativeReasons.push("repeated moderation issues");
  } else if (metrics.rejectedOrHiddenMediaCount >= 1) {
    score -= 2;
    negativeReasons.push("recent moderation issue");
  }

  if (metrics.blockInvolvementCount >= 3) {
    score -= 2;
    negativeReasons.push("multiple block signals");
  }

  const hasWeakInteractionQuality =
    metrics.activeConversationCount === 0 ||
    metrics.activeReportsAgainstUser > 0 ||
    metrics.rejectedOrHiddenMediaCount > 0 ||
    metrics.blockInvolvementCount >= 3;

  if (metrics.outgoingRecentChatRequestCount >= 8 && hasWeakInteractionQuality) {
    score -= 2;
    negativeReasons.push("aggressive request volume with weak quality signals");
  } else if (metrics.outgoingRecentChatRequestCount >= 5 && hasWeakInteractionQuality) {
    score -= 1;
    negativeReasons.push("high request volume with weak quality signals");
  }

  let tier: InternalTrustTier = InternalTrustTier.LOW;
  if (score >= 6) {
    tier = InternalTrustTier.HIGH;
  } else if (score >= 3) {
    tier = InternalTrustTier.NORMAL;
  }

  return {
    tier,
    score,
    summary: summarizeTrustReasons(positiveReasons, negativeReasons),
    positiveReasons,
    negativeReasons,
  };
}

async function collectTrustMetrics(db: TrustDbClient, userId: string, now = new Date()): Promise<TrustMetrics | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      accountStatus: true,
      emailVerified: true,
      phoneVerifiedAt: true,
      createdAt: true,
      activityState: { select: { lastActiveAt: true } },
    },
  });

  if (!user) {
    return null;
  }

  const [activeConversationCount, activeReportsAgainstUser, rejectedProfileCount, hiddenProfileCount, rejectedSotwCount, hiddenSotwCount, blockInvolvementCount, outgoingRecentChatRequestCount] = await Promise.all([
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
    db.userProfileImageAsset.count({
      where: {
        userId,
        moderationStatus: "REJECTED",
      },
    }),
    db.userProfileImageAsset.count({
      where: {
        userId,
        hiddenByModeration: true,
      },
    }),
    db.singleOfWeekApplicationPhoto.count({
      where: {
        application: { applicantUserId: userId },
        moderationStatus: "REJECTED",
      },
    }),
    db.singleOfWeekApplicationPhoto.count({
      where: {
        application: { applicantUserId: userId },
        hiddenByModeration: true,
      },
    }),
    db.userBlock.count({
      where: {
        OR: [{ blockerUserId: userId }, { blockedUserId: userId }],
      },
    }),
    db.chatRequest.count({
      where: {
        fromUserId: userId,
        createdAt: { gte: new Date(now.getTime() - RECENT_CHAT_REQUEST_WINDOW_MS) },
      },
    }),
  ]);

  return {
    accountStatus: user.accountStatus,
    emailVerified: user.emailVerified,
    phoneVerifiedAt: user.phoneVerifiedAt,
    createdAt: user.createdAt,
    lastActiveAt: user.activityState?.lastActiveAt ?? null,
    activeConversationCount,
    activeReportsAgainstUser,
    rejectedOrHiddenMediaCount: rejectedProfileCount + hiddenProfileCount + rejectedSotwCount + hiddenSotwCount,
    blockInvolvementCount,
    outgoingRecentChatRequestCount,
  };
}

export async function recomputeUserTrustState(db: TrustDbClient, userId: string, now = new Date()) {
  const metrics = await collectTrustMetrics(db, userId, now);
  if (!metrics) {
    return null;
  }

  const evaluation = evaluateInternalTrust(metrics, now);
  await db.user.update({
    where: { id: userId },
    data: {
      trustTier: evaluation.tier,
      trustScore: evaluation.score,
      trustSummary: evaluation.summary || null,
      trustUpdatedAt: now,
    },
  });

  return evaluation;
}

export async function refreshUserTrustStates(db: TrustDbClient, userIds: string[], now = new Date()) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) {
    return new Map<string, InternalTrustEvaluation>();
  }

  const entries = await Promise.all(
    uniqueUserIds.map(async (userId) => [userId, await recomputeUserTrustState(db, userId, now)] as const),
  );

  return new Map(entries.filter((entry): entry is readonly [string, InternalTrustEvaluation] => Boolean(entry[1])));
}

export function formatTrustLabel(tier: InternalTrustTier, summary?: string | null) {
  return summary ? `${tier} — ${summary}` : tier;
}
