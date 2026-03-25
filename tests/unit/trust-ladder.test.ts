import assert from "node:assert/strict";
import test from "node:test";
import {
  TRUST_BADGE_KINDS,
  TRUST_LADDER_LEVELS,
  canUserHoldBuddyRole,
  getTrustBadgeCopy,
  getTrustLadderLevel,
  getTrustPromptCopy,
  getUserTrustBadgeKinds,
  hasPhoneVerification,
  isBuddyApprovedUser,
  isConnectedVerifiedUser,
  isIdentityVerifiedUser,
} from "../../src/lib/trust-ladder.ts";
import { VerificationStatus } from "@prisma/client";

test("trust ladder aligns to connected, verified, and buddy", () => {
  assert.equal(getTrustLadderLevel({ emailVerified: null }), TRUST_LADDER_LEVELS.UNVERIFIED);
  assert.equal(getTrustLadderLevel({ emailVerified: new Date("2026-03-25T10:00:00.000Z") }), TRUST_LADDER_LEVELS.CONNECTED);
  assert.equal(getTrustLadderLevel({ emailVerified: null, phoneVerified: true }), TRUST_LADDER_LEVELS.CONNECTED);
  assert.equal(
    getTrustLadderLevel({
      emailVerified: new Date("2026-03-25T10:00:00.000Z"),
      phoneVerified: true,
      kycVerified: true,
    }),
    TRUST_LADDER_LEVELS.VERIFIED,
  );
  assert.equal(
    getTrustLadderLevel({
      emailVerified: new Date("2026-03-25T10:00:00.000Z"),
      phoneVerified: true,
      verificationStatus: VerificationStatus.APPROVED,
      isBuddyApproved: true,
    }),
    TRUST_LADDER_LEVELS.BUDDY,
  );
});

test("trust badge copy no longer uses stale verified-plus or new labels", () => {
  assert.equal(getTrustBadgeCopy(TRUST_LADDER_LEVELS.CONNECTED)?.label, "Connected");
  assert.equal(getTrustBadgeCopy(TRUST_LADDER_LEVELS.VERIFIED)?.label, "Verified");
  assert.equal(getTrustBadgeCopy(TRUST_LADDER_LEVELS.BUDDY)?.label, "Buddy");
  assert.equal(getTrustBadgeCopy(TRUST_LADDER_LEVELS.UNVERIFIED), null);
});

test("future trust prompts stay contextual", () => {
  assert.equal(getTrustPromptCopy(TRUST_LADDER_LEVELS.CONNECTED, "chat"), "Verify your phone to reach more people.");
  assert.equal(getTrustPromptCopy(TRUST_LADDER_LEVELS.CONNECTED, "video"), "This requires higher trust.");
  assert.equal(getTrustPromptCopy(TRUST_LADDER_LEVELS.VERIFIED, "buddy"), null);
  assert.equal(getTrustPromptCopy(TRUST_LADDER_LEVELS.BUDDY, "video"), null);
});

test("phone verification is aligned across ladder and badge derivation", () => {
  const phoneOnlyUser = { emailVerified: null, phoneVerified: true };

  assert.equal(hasPhoneVerification(phoneOnlyUser), true);
  assert.equal(isConnectedVerifiedUser(phoneOnlyUser), true);
  assert.equal(getTrustLadderLevel(phoneOnlyUser), TRUST_LADDER_LEVELS.CONNECTED);
  assert.deepEqual(getUserTrustBadgeKinds(phoneOnlyUser), [TRUST_BADGE_KINDS.CONNECTED]);
});

test("connected, verified, and buddy states are derived separately", () => {
  const connectedUser = { emailVerified: new Date("2026-03-25T10:00:00.000Z") };
  const verifiedUser = { emailVerified: new Date("2026-03-25T10:00:00.000Z"), verificationStatus: VerificationStatus.APPROVED };
  const buddyUser = {
    emailVerified: new Date("2026-03-25T10:00:00.000Z"),
    verificationStatus: VerificationStatus.APPROVED,
    isBuddyApproved: true,
  };

  assert.equal(isConnectedVerifiedUser(connectedUser), true);
  assert.equal(isIdentityVerifiedUser(connectedUser), false);
  assert.equal(isIdentityVerifiedUser(verifiedUser), true);
  assert.equal(canUserHoldBuddyRole(verifiedUser), true);
  assert.equal(isBuddyApprovedUser(buddyUser), true);
});

test("badge order stays verified, buddy, connected", () => {
  assert.deepEqual(
    getUserTrustBadgeKinds({
      emailVerified: new Date("2026-03-25T10:00:00.000Z"),
      phoneVerified: true,
      verificationStatus: VerificationStatus.APPROVED,
      isBuddyApproved: true,
    }),
    [TRUST_BADGE_KINDS.VERIFIED, TRUST_BADGE_KINDS.BUDDY, TRUST_BADGE_KINDS.CONNECTED],
  );
});

test("buddy badge is suppressed for invalid legacy states", () => {
  assert.equal(
    isBuddyApprovedUser({
      emailVerified: null,
      verificationStatus: VerificationStatus.APPROVED,
      isBuddyApproved: true,
    }),
    false,
  );
});
