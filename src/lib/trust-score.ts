import { AccountStatus, InternalTrustTier, Prisma, TrustScoreEventType } from "@prisma/client";

export const TRUST_SCORE_DEFAULT = 50;
export const TRUST_SCORE_MIN = 0;
export const TRUST_SCORE_MAX = 100;

export const TRUST_SCORE_BANDS = {
  LOW: "LOW",
  CAUTION: "CAUTION",
  NORMAL: "NORMAL",
  STRONG: "STRONG",
  HIGH: "HIGH",
} as const;

export type TrustScoreBand = (typeof TRUST_SCORE_BANDS)[keyof typeof TRUST_SCORE_BANDS];

export type TrustScoreMetrics = {
  accountStatus: AccountStatus;
  emailVerified: Date | null;
  phoneVerifiedAt: Date | null;
  kycVerified?: boolean;
  createdAt: Date;
  lastActiveAt: Date | null;
  activeConversationCount: number;
  receivedReactionCount: number;
  receivedReplyCount: number;
  activeReportsAgainstUser: number;
  confirmedModerationIssueCount: number;
  uniqueBlockCount: number;
  outgoingRecentChatRequestCount: number;
};

export type TrustScoreEvaluation = {
  score: number;
  band: TrustScoreBand;
  tier: InternalTrustTier;
  summary: string;
  positiveReasons: string[];
  negativeReasons: string[];
};

export type TrustScoreChangeEventInput = {
  userId: string;
  previousScore: number;
  nextScore: number;
  eventType: TrustScoreEventType;
  reason: string;
  sourceUserId?: string | null;
  metadata?: Record<string, unknown> | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_ACTIVITY_WINDOW_MS = 14 * DAY_MS;
const MATURE_ACCOUNT_WINDOW_MS = 30 * DAY_MS;
const VERY_MATURE_ACCOUNT_WINDOW_MS = 90 * DAY_MS;

export function clampTrustScore(value: number) {
  return Math.min(TRUST_SCORE_MAX, Math.max(TRUST_SCORE_MIN, Math.round(value)));
}

export function getTrustScoreBand(score: number): TrustScoreBand {
  const clamped = clampTrustScore(score);

  if (clamped <= 24) return TRUST_SCORE_BANDS.LOW;
  if (clamped <= 49) return TRUST_SCORE_BANDS.CAUTION;
  if (clamped <= 69) return TRUST_SCORE_BANDS.NORMAL;
  if (clamped <= 84) return TRUST_SCORE_BANDS.STRONG;
  return TRUST_SCORE_BANDS.HIGH;
}

export function mapTrustScoreBandToTier(band: TrustScoreBand): InternalTrustTier {
  switch (band) {
    case TRUST_SCORE_BANDS.HIGH:
      return InternalTrustTier.HIGH;
    case TRUST_SCORE_BANDS.NORMAL:
    case TRUST_SCORE_BANDS.STRONG:
      return InternalTrustTier.NORMAL;
    default:
      return InternalTrustTier.LOW;
  }
}

export function trustScoreMeetsThreshold(score: number, minimum: number) {
  return clampTrustScore(score) >= clampTrustScore(minimum);
}

export function compareUsersByTrustScore<T extends { trustScore: number }>(left: T, right: T) {
  return clampTrustScore(right.trustScore) - clampTrustScore(left.trustScore);
}

export function shouldUseTighterTrustCaps(score: number) {
  const band = getTrustScoreBand(score);
  return band === TRUST_SCORE_BANDS.LOW || band === TRUST_SCORE_BANDS.CAUTION;
}

function summarizeReasons(positiveReasons: string[], negativeReasons: string[]) {
  const headline = negativeReasons.length > 0 ? negativeReasons.slice(0, 2) : positiveReasons.slice(0, 3);
  return headline.join(", ");
}

export function computeTrustScoreEvaluation(metrics: TrustScoreMetrics, now = new Date()): TrustScoreEvaluation {
  let score = TRUST_SCORE_DEFAULT;
  const positiveReasons: string[] = [];
  const negativeReasons: string[] = [];

  if (metrics.accountStatus !== AccountStatus.ACTIVE) {
    const clamped = clampTrustScore(20);
    const band = getTrustScoreBand(clamped);
    return {
      score: clamped,
      band,
      tier: mapTrustScoreBandToTier(band),
      summary: "inactive account",
      positiveReasons,
      negativeReasons: ["inactive account"],
    };
  }

  if (metrics.emailVerified) {
    score += 8;
    positiveReasons.push("verified email");
  }

  if (metrics.phoneVerifiedAt) {
    score += 10;
    positiveReasons.push("verified phone");
  }

  if (metrics.kycVerified) {
    score += 16;
    positiveReasons.push("kyc verified");
  }

  const accountAgeMs = now.getTime() - metrics.createdAt.getTime();
  if (accountAgeMs >= VERY_MATURE_ACCOUNT_WINDOW_MS) {
    score += 6;
    positiveReasons.push("steady account age");
  } else if (accountAgeMs >= MATURE_ACCOUNT_WINDOW_MS) {
    score += 4;
    positiveReasons.push("established account age");
  }

  if (metrics.lastActiveAt && now.getTime() - metrics.lastActiveAt.getTime() <= RECENT_ACTIVITY_WINDOW_MS) {
    score += 3;
    positiveReasons.push("steady activity");
  }

  if (metrics.activeConversationCount >= 5) {
    score += 8;
    positiveReasons.push("approved interaction history");
  } else if (metrics.activeConversationCount >= 1) {
    score += 4;
    positiveReasons.push("first approved interaction");
  }

  if (metrics.receivedReactionCount >= 5) {
    score += 4;
    positiveReasons.push("noticed by others");
  } else if (metrics.receivedReactionCount >= 1) {
    score += 2;
    positiveReasons.push("first reaction received");
  }

  if (metrics.receivedReplyCount >= 3) {
    score += 5;
    positiveReasons.push("conversation coming back");
  } else if (metrics.receivedReplyCount >= 1) {
    score += 3;
    positiveReasons.push("first reply received");
  }

  if (metrics.activeReportsAgainstUser >= 3) {
    score -= 20;
    negativeReasons.push("multiple active reports");
  } else if (metrics.activeReportsAgainstUser >= 1) {
    score -= 10;
    negativeReasons.push("active report under review");
  }

  if (metrics.confirmedModerationIssueCount >= 3) {
    score -= 20;
    negativeReasons.push("repeated moderation actions");
  } else if (metrics.confirmedModerationIssueCount >= 1) {
    score -= 12;
    negativeReasons.push("confirmed moderation action");
  }

  if (metrics.uniqueBlockCount >= 6) {
    score -= 10;
    negativeReasons.push("multiple unique-user blocks");
  } else if (metrics.uniqueBlockCount >= 3) {
    score -= 6;
    negativeReasons.push("repeated block signals");
  }

  const hasWeakInteractionQuality =
    metrics.activeConversationCount === 0 ||
    metrics.activeReportsAgainstUser > 0 ||
    metrics.confirmedModerationIssueCount > 0 ||
    metrics.uniqueBlockCount >= 3;

  if (metrics.outgoingRecentChatRequestCount >= 8 && hasWeakInteractionQuality) {
    score -= 8;
    negativeReasons.push("aggressive request volume with weak quality signals");
  } else if (metrics.outgoingRecentChatRequestCount >= 5 && hasWeakInteractionQuality) {
    score -= 4;
    negativeReasons.push("high request volume with weak quality signals");
  }

  const clamped = clampTrustScore(score);
  const band = getTrustScoreBand(clamped);

  return {
    score: clamped,
    band,
    tier: mapTrustScoreBandToTier(band),
    summary: summarizeReasons(positiveReasons, negativeReasons),
    positiveReasons,
    negativeReasons,
  };
}

export function createTrustScoreChangeEventData(input: TrustScoreChangeEventInput) {
  const previousScore = clampTrustScore(input.previousScore);
  const nextScore = clampTrustScore(input.nextScore);
  const delta = nextScore - previousScore;

  if (delta === 0) {
    return null;
  }

  return {
    userId: input.userId,
    eventType: input.eventType,
    delta,
    reason: input.reason,
    sourceUserId: input.sourceUserId ?? null,
    metadataJson: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}




