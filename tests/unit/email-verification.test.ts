import assert from "node:assert/strict";
import test from "node:test";
import {
  EMAIL_VERIFICATION_TOKEN_TTL_HOURS,
  buildEmailVerificationUrl,
  createEmailVerificationTokenPayload,
  evaluateEmailVerificationTokenRecord,
  getEmailVerificationResendState,
  hashEmailVerificationToken,
  sendVerificationEmail,
} from "../../src/lib/email-verification.ts";
import { isBuddyVerifiedUser } from "../../src/lib/buddy.ts";
import { isSingleOfWeekVerifiedUser } from "../../src/lib/single-of-the-week.ts";

test("token payload stores a hash and expiry without persisting the raw token", () => {
  const now = new Date("2026-03-21T10:00:00.000Z");
  const payload = createEmailVerificationTokenPayload("user-1", "member@evyta.dev", now);

  assert.equal(payload.userId, "user-1");
  assert.equal(payload.email, "member@evyta.dev");
  assert.notEqual(payload.rawToken, payload.tokenHash);
  assert.equal(payload.tokenHash, hashEmailVerificationToken(payload.rawToken));
  assert.equal(payload.expiresAt.toISOString(), new Date(now.getTime() + EMAIL_VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString());
});

test("verification record evaluation handles valid, expired, used, and mismatched states", () => {
  const now = new Date("2026-03-21T10:00:00.000Z");
  const baseRecord = {
    tokenHash: "hash",
    email: "member@evyta.dev",
    expiresAt: new Date("2026-03-22T10:00:00.000Z"),
    usedAt: null,
  };

  assert.equal(evaluateEmailVerificationTokenRecord(baseRecord, "member@evyta.dev", now), "verified");
  assert.equal(evaluateEmailVerificationTokenRecord({ ...baseRecord, expiresAt: new Date("2026-03-20T10:00:00.000Z") }, "member@evyta.dev", now), "expired");
  assert.equal(evaluateEmailVerificationTokenRecord({ ...baseRecord, usedAt: new Date("2026-03-21T09:00:00.000Z") }, "member@evyta.dev", now), "used");
  assert.equal(evaluateEmailVerificationTokenRecord(baseRecord, "changed@evyta.dev", now), "email_mismatch");
  assert.equal(evaluateEmailVerificationTokenRecord(null, "member@evyta.dev", now), "invalid");
});

test("resend rate limiting blocks rapid repeats and daily spam", () => {
  const now = new Date("2026-03-21T10:00:00.000Z");
  const cooldownBlocked = getEmailVerificationResendState({
    lastIssuedAt: new Date("2026-03-21T09:58:00.000Z"),
    recentCount: 1,
    now,
  });
  assert.equal(cooldownBlocked.blocked, true);

  const dailyBlocked = getEmailVerificationResendState({
    lastIssuedAt: new Date("2026-03-21T09:00:00.000Z"),
    recentCount: 6,
    now,
  });
  assert.equal(dailyBlocked.blocked, true);

  const allowed = getEmailVerificationResendState({
    lastIssuedAt: new Date("2026-03-21T09:00:00.000Z"),
    recentCount: 2,
    now,
  });
  assert.equal(allowed.blocked, false);
});

test("verification links can preserve a return path back into onboarding", () => {
  const url = buildEmailVerificationUrl("raw-token", "http://localhost:3000", "/onboarding?step=3");
  assert.equal(url, "http://localhost:3000/verify-email?token=raw-token&next=%2Fonboarding%3Fstep%3D3");
});

test("console delivery mode logs the verification link for dev use", async () => {
  const previousMode = process.env.EMAIL_DELIVERY_MODE;
  process.env.EMAIL_DELIVERY_MODE = "console";

  const messages: string[] = [];
  const originalInfo = console.info;
  console.info = (message?: unknown, ...optionalParams: unknown[]) => {
    messages.push([message, ...optionalParams].map((entry) => String(entry)).join(" "));
  };

  try {
    const verificationUrl = buildEmailVerificationUrl("raw-token", "http://localhost:3000");
    const result = await sendVerificationEmail({
      toEmail: "member@evyta.dev",
      verificationUrl,
      expiresAt: new Date("2026-03-22T10:00:00.000Z"),
    });

    assert.equal(result.deliveryMode, "console");
    assert.equal(result.previewUrl, verificationUrl);
    assert.ok(messages.some((entry) => entry.includes(verificationUrl)));
  } finally {
    console.info = originalInfo;
    process.env.EMAIL_DELIVERY_MODE = previousMode;
  }
});

test("resend delivery mode uses the provider adapter path", async () => {
  const previousMode = process.env.EMAIL_DELIVERY_MODE;
  const previousApiKey = process.env.RESEND_API_KEY;
  const previousEmailFrom = process.env.EMAIL_FROM;
  process.env.EMAIL_DELIVERY_MODE = "resend";
  process.env.RESEND_API_KEY = "test-key";
  process.env.EMAIL_FROM = "hello@evyta.dev";

  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const originalFetch = global.fetch;
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: "mail_123" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    const result = await sendVerificationEmail({
      toEmail: "member@evyta.dev",
      verificationUrl: "http://localhost:3000/verify-email?token=abc",
      expiresAt: new Date("2026-03-22T10:00:00.000Z"),
    });

    assert.equal(result.deliveryMode, "resend");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://api.resend.com/emails");
  } finally {
    global.fetch = originalFetch;
    process.env.EMAIL_DELIVERY_MODE = previousMode;
    process.env.RESEND_API_KEY = previousApiKey;
    process.env.EMAIL_FROM = previousEmailFrom;
  }
});

test("trusted feature eligibility still depends on real verified email state", () => {
  const verifiedAt = new Date("2026-03-21T10:00:00.000Z");
  assert.equal(isBuddyVerifiedUser({ emailVerified: null, phoneVerifiedAt: verifiedAt }), false);
  assert.equal(isBuddyVerifiedUser({ emailVerified: verifiedAt, phoneVerifiedAt: verifiedAt }), true);
  assert.equal(isSingleOfWeekVerifiedUser({ emailVerified: null, phoneVerifiedAt: verifiedAt }), false);
  assert.equal(isSingleOfWeekVerifiedUser({ emailVerified: verifiedAt, phoneVerifiedAt: verifiedAt }), true);
});
