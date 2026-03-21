import assert from "node:assert/strict";
import test from "node:test";
import { AccountStatus, MediaModerationStatus, SingleOfWeekApplicationStatus, SingleOfWeekFeatureStatus } from "@prisma/client";
import {
  formatPendingAge,
  formatWeightedSignalSummary,
  getMediaQueuePriority,
  getMediaQueuePriorityRank,
  getMediaReviewStartedAt,
  getMediaStaleState,
  getReporterTrustTier,
  getReporterTrustWeight,
  isMediaPubliclyVisible,
  isReporterSignalSuppressed,
  needsMediaModerationReview,
  summarizeWeightedReportSignal,
} from "../../src/lib/media-moderation.ts";

test("Single of the Week media gets higher priority than regular profile media", () => {
  const featuredPriority = getMediaQueuePriority({
    type: "single-of-week",
    applicationStatus: SingleOfWeekApplicationStatus.SELECTED,
    featureStatuses: [SingleOfWeekFeatureStatus.ACTIVE],
  });
  const profilePriority = getMediaQueuePriority({
    type: "profile",
    lastActiveAt: null,
    now: new Date("2026-03-21T12:00:00.000Z"),
  });

  assert.equal(featuredPriority, "urgent_featured");
  assert.equal(profilePriority, "profile");
  assert.ok(getMediaQueuePriorityRank(featuredPriority) < getMediaQueuePriorityRank(profilePriority));
});

test("oldest items sort first within the same priority bucket", () => {
  const older = getMediaReviewStartedAt({ uploadedAt: new Date("2026-03-18T09:00:00.000Z") });
  const newer = getMediaReviewStartedAt({ uploadedAt: new Date("2026-03-19T15:00:00.000Z") });
  assert.ok(older.getTime() < newer.getTime());
});

test("stale indicators use 24h and 72h thresholds", () => {
  const now = new Date("2026-03-21T12:00:00.000Z");
  assert.equal(getMediaStaleState(new Date("2026-03-21T02:00:00.000Z"), now), "fresh");
  assert.equal(getMediaStaleState(new Date("2026-03-20T10:00:00.000Z"), now), "over_24h");
  assert.equal(getMediaStaleState(new Date("2026-03-18T09:00:00.000Z"), now), "over_72h");
  assert.equal(formatPendingAge(new Date("2026-03-18T09:00:00.000Z"), now), "3d 3h");
});

test("pending or auto-hidden media still need review and hidden approved media is not public", () => {
  assert.equal(needsMediaModerationReview({ moderationStatus: MediaModerationStatus.PENDING_REVIEW, hiddenByModeration: false }), true);
  assert.equal(needsMediaModerationReview({ moderationStatus: MediaModerationStatus.APPROVED, hiddenByModeration: true }), true);
  assert.equal(isMediaPubliclyVisible({ moderationStatus: MediaModerationStatus.APPROVED, hiddenByModeration: true }), false);
  assert.equal(isMediaPubliclyVisible({ moderationStatus: MediaModerationStatus.APPROVED, hiddenByModeration: false }), true);
});

test("higher-trust reporters contribute more weight than low-trust reporters", () => {
  const highReporter = {
    accountStatus: AccountStatus.ACTIVE,
    emailVerified: new Date("2026-01-01T00:00:00.000Z"),
    phoneVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    approvedConversationCount: 3,
    activeReportsAgainstReporter: 0,
    activeBlockCount: 0,
    recentFiledReportCount: 1,
  };
  const lowReporter = {
    accountStatus: AccountStatus.ACTIVE,
    emailVerified: null,
    phoneVerifiedAt: null,
    approvedConversationCount: 0,
    activeReportsAgainstReporter: 0,
    activeBlockCount: 0,
    recentFiledReportCount: 1,
  };

  assert.equal(getReporterTrustTier(highReporter), "HIGH");
  assert.equal(getReporterTrustTier(lowReporter), "LOW");
  assert.ok(getReporterTrustWeight("HIGH") > getReporterTrustWeight("LOW"));
});

test("low-trust reporters alone do not trigger the weighted auto-hide threshold", () => {
  const lowTrustSummary = summarizeWeightedReportSignal([
    {
      reportId: "r1",
      reporterUserId: "u1",
      reporter: {
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: null,
        phoneVerifiedAt: null,
        approvedConversationCount: 0,
        activeReportsAgainstReporter: 0,
        activeBlockCount: 0,
        recentFiledReportCount: 1,
      },
    },
    {
      reportId: "r2",
      reporterUserId: "u2",
      reporter: {
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: null,
        phoneVerifiedAt: null,
        approvedConversationCount: 0,
        activeReportsAgainstReporter: 0,
        activeBlockCount: 0,
        recentFiledReportCount: 1,
      },
    },
  ]);

  const highTrustSummary = summarizeWeightedReportSignal([
    {
      reportId: "r3",
      reporterUserId: "u3",
      reporter: {
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: new Date("2026-01-01T00:00:00.000Z"),
        phoneVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
        approvedConversationCount: 2,
        activeReportsAgainstReporter: 0,
        activeBlockCount: 0,
        recentFiledReportCount: 1,
      },
    },
    {
      reportId: "r4",
      reporterUserId: "u4",
      reporter: {
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: new Date("2026-01-01T00:00:00.000Z"),
        phoneVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
        approvedConversationCount: 1,
        activeReportsAgainstReporter: 0,
        activeBlockCount: 0,
        recentFiledReportCount: 1,
      },
    },
  ]);

  assert.equal(lowTrustSummary.weightedScore, 1);
  assert.equal(lowTrustSummary.triggered, false);
  assert.equal(highTrustSummary.weightedScore, 4);
  assert.equal(highTrustSummary.triggered, true);
});

test("duplicate reports from the same reporter do not inflate weighted signal", () => {
  const summary = summarizeWeightedReportSignal([
    {
      reportId: "r1",
      reporterUserId: "repeat-user",
      reporter: {
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: new Date("2026-01-01T00:00:00.000Z"),
        phoneVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
        approvedConversationCount: 2,
        activeReportsAgainstReporter: 0,
        activeBlockCount: 0,
        recentFiledReportCount: 1,
      },
    },
    {
      reportId: "r2",
      reporterUserId: "repeat-user",
      reporter: {
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: new Date("2026-01-01T00:00:00.000Z"),
        phoneVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
        approvedConversationCount: 2,
        activeReportsAgainstReporter: 0,
        activeBlockCount: 0,
        recentFiledReportCount: 1,
      },
    },
  ]);

  assert.equal(summary.rawReportCount, 2);
  assert.equal(summary.distinctReporterCount, 1);
  assert.equal(summary.weightedScore, 2);
  assert.equal(summary.dedupedReportIds.length, 1);
});

test("suppressed reporters contribute no weight and are tracked separately", () => {
  const suppressedReporter = {
    accountStatus: AccountStatus.ACTIVE,
    emailVerified: new Date("2026-01-01T00:00:00.000Z"),
    phoneVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    approvedConversationCount: 4,
    activeReportsAgainstReporter: 3,
    activeBlockCount: 0,
    recentFiledReportCount: 12,
  };

  assert.equal(isReporterSignalSuppressed(suppressedReporter), true);

  const summary = summarizeWeightedReportSignal([
    {
      reportId: "r1",
      reporterUserId: "suppressed",
      reporter: suppressedReporter,
    },
  ]);

  assert.equal(summary.weightedScore, 0);
  assert.equal(summary.suppressedReporterCount, 1);
  assert.equal(summary.contributingReporterCount, 0);
  assert.equal(summary.triggered, false);
});

test("auto-hide trigger is based on weighted score instead of raw count alone", () => {
  const summary = summarizeWeightedReportSignal([
    {
      reportId: "r1",
      reporterUserId: "high",
      reporter: {
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: new Date("2026-01-01T00:00:00.000Z"),
        phoneVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
        approvedConversationCount: 2,
        activeReportsAgainstReporter: 0,
        activeBlockCount: 0,
        recentFiledReportCount: 1,
      },
    },
    {
      reportId: "r2",
      reporterUserId: "low",
      reporter: {
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: null,
        phoneVerifiedAt: null,
        approvedConversationCount: 0,
        activeReportsAgainstReporter: 0,
        activeBlockCount: 0,
        recentFiledReportCount: 1,
      },
    },
  ]);

  assert.equal(summary.rawReportCount, 2);
  assert.equal(summary.weightedScore, 2.5);
  assert.equal(summary.triggered, true);
});

test("weighted summary formatting preserves moderation explainability", () => {
  const summary = summarizeWeightedReportSignal([
    {
      reportId: "r1",
      reporterUserId: "high",
      reporter: {
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: new Date("2026-01-01T00:00:00.000Z"),
        phoneVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
        approvedConversationCount: 2,
        activeReportsAgainstReporter: 0,
        activeBlockCount: 0,
        recentFiledReportCount: 1,
      },
    },
    {
      reportId: "r2",
      reporterUserId: "normal",
      reporter: {
        accountStatus: AccountStatus.ACTIVE,
        emailVerified: new Date("2026-01-01T00:00:00.000Z"),
        phoneVerifiedAt: null,
        approvedConversationCount: 0,
        activeReportsAgainstReporter: 0,
        activeBlockCount: 0,
        recentFiledReportCount: 1,
      },
    },
  ]);

  const summaryText = formatWeightedSignalSummary(summary);
  assert.match(summaryText, /Weighted signal 2\.5 \/ 2\.5/);
  assert.match(summaryText, /2 distinct reporters/);
});
