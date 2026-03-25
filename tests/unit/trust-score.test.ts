import assert from "node:assert/strict";
import test from "node:test";
import { AccountStatus, InternalTrustTier, TrustScoreEventType } from "@prisma/client";
import {
  TRUST_SCORE_BANDS,
  clampTrustScore,
  compareUsersByTrustScore,
  computeTrustScoreEvaluation,
  createTrustScoreChangeEventData,
  getTrustScoreBand,
  mapTrustScoreBandToTier,
  shouldUseTighterTrustCaps,
  trustScoreMeetsThreshold,
} from "../../src/lib/trust-score.ts";
import { SINGLE_OF_WEEK_MIN_TRUST_SCORE } from "../../src/lib/single-of-the-week.ts";

test("trust score bands and clamping stay within the 0 to 100 system", () => {
  assert.equal(clampTrustScore(-10), 0);
  assert.equal(clampTrustScore(104), 100);
  assert.equal(getTrustScoreBand(20), TRUST_SCORE_BANDS.LOW);
  assert.equal(getTrustScoreBand(35), TRUST_SCORE_BANDS.CAUTION);
  assert.equal(getTrustScoreBand(60), TRUST_SCORE_BANDS.NORMAL);
  assert.equal(getTrustScoreBand(80), TRUST_SCORE_BANDS.STRONG);
  assert.equal(getTrustScoreBand(95), TRUST_SCORE_BANDS.HIGH);
});

test("trust score evaluation rewards verified steady activity and maps back to internal tiers", () => {
  const evaluation = computeTrustScoreEvaluation({
    accountStatus: AccountStatus.ACTIVE,
    emailVerified: new Date("2026-03-01T00:00:00.000Z"),
    phoneVerifiedAt: new Date("2026-03-02T00:00:00.000Z"),
    kycVerified: false,
    createdAt: new Date("2025-11-01T00:00:00.000Z"),
    lastActiveAt: new Date("2026-03-24T00:00:00.000Z"),
    activeConversationCount: 3,
    receivedReactionCount: 2,
    receivedReplyCount: 1,
    activeReportsAgainstUser: 0,
    confirmedModerationIssueCount: 0,
    uniqueBlockCount: 0,
    outgoingRecentChatRequestCount: 1,
  }, new Date("2026-03-25T00:00:00.000Z"));

  assert.ok(evaluation.score > 50);
  assert.equal(evaluation.band, TRUST_SCORE_BANDS.HIGH);
  assert.equal(evaluation.tier, InternalTrustTier.HIGH);
  assert.ok(evaluation.positiveReasons.includes("verified email"));
});

test("trust score evaluation penalizes confirmed risk signals", () => {
  const evaluation = computeTrustScoreEvaluation({
    accountStatus: AccountStatus.ACTIVE,
    emailVerified: null,
    phoneVerifiedAt: null,
    kycVerified: false,
    createdAt: new Date("2026-03-20T00:00:00.000Z"),
    lastActiveAt: null,
    activeConversationCount: 0,
    receivedReactionCount: 0,
    receivedReplyCount: 0,
    activeReportsAgainstUser: 2,
    confirmedModerationIssueCount: 1,
    uniqueBlockCount: 4,
    outgoingRecentChatRequestCount: 7,
  }, new Date("2026-03-25T00:00:00.000Z"));

  assert.ok(evaluation.score < 50);
  assert.equal(evaluation.band, TRUST_SCORE_BANDS.LOW);
  assert.equal(mapTrustScoreBandToTier(evaluation.band), InternalTrustTier.LOW);
  assert.ok(evaluation.negativeReasons.includes("confirmed moderation action"));
});

test("trust score helpers expose threshold and future abuse-control hooks", () => {
  assert.equal(trustScoreMeetsThreshold(61, SINGLE_OF_WEEK_MIN_TRUST_SCORE), true);
  assert.equal(trustScoreMeetsThreshold(58, SINGLE_OF_WEEK_MIN_TRUST_SCORE), false);
  assert.equal(shouldUseTighterTrustCaps(24), true);
  assert.equal(shouldUseTighterTrustCaps(72), false);
  assert.deepEqual(
    [{ trustScore: 52 }, { trustScore: 81 }, { trustScore: 39 }].sort(compareUsersByTrustScore).map((entry) => entry.trustScore),
    [81, 52, 39],
  );
});

test("trust score change events are only created when the score actually changes", () => {
  const event = createTrustScoreChangeEventData({
    userId: "user-1",
    previousScore: 50,
    nextScore: 62,
    eventType: TrustScoreEventType.RECOMPUTE,
    reason: "verified email, approved interaction history",
    sourceUserId: null,
    metadata: { nextBand: TRUST_SCORE_BANDS.NORMAL },
  });

  assert.equal(event?.delta, 12);
  assert.equal(event?.eventType, TrustScoreEventType.RECOMPUTE);
  assert.equal(createTrustScoreChangeEventData({
    userId: "user-1",
    previousScore: 62,
    nextScore: 62,
    eventType: TrustScoreEventType.RECOMPUTE,
    reason: "no change",
  }), null);
});



