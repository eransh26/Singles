import assert from "node:assert/strict";
import test from "node:test";
import { AccountStatus, InternalTrustTier } from "@prisma/client";
import { evaluateInternalTrust, formatTrustLabel } from "../../src/lib/internal-trust.ts";

const now = new Date("2026-03-21T12:00:00.000Z");

function baseHealthyMetrics() {
  return {
    accountStatus: AccountStatus.ACTIVE,
    emailVerified: new Date("2026-01-01T00:00:00.000Z"),
    phoneVerifiedAt: new Date("2026-01-02T00:00:00.000Z"),
    createdAt: new Date("2025-12-01T00:00:00.000Z"),
    lastActiveAt: new Date("2026-03-20T12:00:00.000Z"),
    activeConversationCount: 2,
    activeReportsAgainstUser: 0,
    rejectedOrHiddenMediaCount: 0,
    blockInvolvementCount: 0,
    outgoingRecentChatRequestCount: 1,
  };
}

test("verified and healthy users receive higher trust than problematic users", () => {
  const healthy = evaluateInternalTrust(
    {
      ...baseHealthyMetrics(),
      createdAt: new Date("2025-10-01T00:00:00.000Z"),
      activeConversationCount: 6,
    },
    now,
  );

  const problematic = evaluateInternalTrust(
    {
      accountStatus: AccountStatus.ACTIVE,
      emailVerified: null,
      phoneVerifiedAt: null,
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      lastActiveAt: null,
      activeConversationCount: 0,
      activeReportsAgainstUser: 3,
      rejectedOrHiddenMediaCount: 2,
      blockInvolvementCount: 4,
      outgoingRecentChatRequestCount: 8,
    },
    now,
  );

  assert.equal(healthy.tier, InternalTrustTier.HIGH);
  assert.equal(problematic.tier, InternalTrustTier.LOW);
  assert.ok(healthy.score > problematic.score);
});

test("a single active report now softens trust less aggressively", () => {
  const baseline = evaluateInternalTrust(baseHealthyMetrics(), now);
  const withSingleReport = evaluateInternalTrust(
    {
      ...baseHealthyMetrics(),
      activeReportsAgainstUser: 1,
    },
    now,
  );

  assert.equal(baseline.score - withSingleReport.score, 1);
  assert.equal(withSingleReport.tier, InternalTrustTier.HIGH);
  assert.match(withSingleReport.summary, /report/i);
});

test("high chat volume alone does not penalize a healthy approved user", () => {
  const calm = evaluateInternalTrust(baseHealthyMetrics(), now);
  const activeButHealthy = evaluateInternalTrust(
    {
      ...baseHealthyMetrics(),
      outgoingRecentChatRequestCount: 8,
      activeConversationCount: 3,
    },
    now,
  );

  assert.equal(activeButHealthy.score, calm.score);
  assert.equal(activeButHealthy.tier, calm.tier);
  assert.doesNotMatch(activeButHealthy.summary, /request volume/i);
});

test("high chat volume with low quality signals does reduce trust", () => {
  const calm = evaluateInternalTrust(baseHealthyMetrics(), now);
  const lowQuality = evaluateInternalTrust(
    {
      ...baseHealthyMetrics(),
      activeConversationCount: 0,
      outgoingRecentChatRequestCount: 8,
    },
    now,
  );

  assert.ok(lowQuality.score < calm.score);
  assert.match(lowQuality.summary, /request volume/i);
});

test("trust tier boundaries remain sensible after tuning", () => {
  const high = evaluateInternalTrust(
    {
      ...baseHealthyMetrics(),
      createdAt: new Date("2025-09-01T00:00:00.000Z"),
      activeConversationCount: 6,
    },
    now,
  );
  const normal = evaluateInternalTrust(
    {
      ...baseHealthyMetrics(),
      createdAt: new Date("2026-03-05T00:00:00.000Z"),
      lastActiveAt: null,
      activeConversationCount: 1,
    },
    now,
  );
  const low = evaluateInternalTrust(
    {
      ...baseHealthyMetrics(),
      emailVerified: null,
      phoneVerifiedAt: null,
      activeConversationCount: 0,
      activeReportsAgainstUser: 3,
      rejectedOrHiddenMediaCount: 1,
    },
    now,
  );

  assert.equal(high.tier, InternalTrustTier.HIGH);
  assert.equal(normal.tier, InternalTrustTier.NORMAL);
  assert.equal(low.tier, InternalTrustTier.LOW);
});

test("trust labels stay compact and explainable", () => {
  assert.match(formatTrustLabel(InternalTrustTier.NORMAL, "verified email, approved chat history"), /^NORMAL .*verified email, approved chat history$/);
  assert.equal(formatTrustLabel(InternalTrustTier.LOW), "LOW");
});
