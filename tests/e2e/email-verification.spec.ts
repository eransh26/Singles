import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashEmailVerificationToken } from "../../src/lib/email-verification";
import { loadSeedData, loginAs, resetE2EState } from "./helpers";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL,
    },
  },
});

test.beforeEach(() => {
  resetE2EState();
  test.setTimeout(90000);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

function flagForm(page: import("@playwright/test").Page, key: string) {
  return page.locator('[data-testid="admin-feature-flags"] form').filter({ has: page.getByText(key) }).first();
}

async function setFlagEnabled(page: import("@playwright/test").Page, key: string, enabled: boolean) {
  const form = flagForm(page, key);
  await expect(form).toBeVisible();
  const checkbox = form.getByLabel(`Enable ${key}`);
  if (enabled) {
    await checkbox.check();
  } else {
    await checkbox.uncheck();
  }
  await form.getByRole("button", { name: /save flag/i }).click();
  await expect(page).toHaveURL(/saved=feature-flag/);
}

async function loginAsAdminAndSetEmailFlag(page: import("@playwright/test").Page, enabled: boolean) {
  const seed = loadSeedData();
  await page.context().clearCookies();
  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);
  await page.goto("/admin/feature-flags");
  await setFlagEnabled(page, "email_verification_enabled", enabled);
  return seed;
}

test("onboarding sends an email link and enforces resend cooldown", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto("/onboarding?step=3");
  await expect(page.getByTestId("onboarding-verification-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: /keep the circle trusted/i })).toBeVisible();

  await page.getByRole("button", { name: /send verification link/i }).click();
  await expect(page).toHaveURL(/saved=email-verification-sent/);
  await expect(page.getByText(/verification link sent/i)).toBeVisible();

  const resendButton = page.getByRole("button", { name: /resend verification link/i });
  await expect(resendButton).toBeDisabled();
  await expect(page.getByText(/resend available in about/i)).toBeVisible();
});

test("verify-email callback marks the user verified and returns to onboarding", async ({ page }) => {
  const seed = loadSeedData();
  const rawToken = `playwright-token-${Date.now()}`;
  const member = await prisma.user.findUniqueOrThrow({
    where: { email: seed.users.member.email },
    select: { id: true, email: true },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId: member.id,
      email: member.email,
      tokenHash: hashEmailVerificationToken(rawToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto(`/verify-email?token=${encodeURIComponent(rawToken)}&next=${encodeURIComponent("/onboarding?step=3")}`);

  await expect(page).toHaveURL(/\/onboarding\?step=3&saved=email-verified$/);
  await expect(page.getByText("Your email is verified. You can keep going.")).toBeVisible();

  const refreshedMember = await prisma.user.findUniqueOrThrow({
    where: { id: member.id },
    select: { emailVerified: true },
  });
  expect(refreshedMember.emailVerified).not.toBeNull();
});


test("verified onboarding shows the first-action screen and first post unlocks visibility", async ({ page }) => {
  const seed = loadSeedData();
  const rawToken = `playwright-first-post-${Date.now()}`;
  const member = await prisma.user.findUniqueOrThrow({
    where: { email: seed.users.member.email },
    select: { id: true, email: true },
  });

  const memberPosts = await prisma.post.findMany({ where: { authorUserId: member.id }, select: { id: true } });
  const memberPostIds = memberPosts.map((post) => post.id);
  if (memberPostIds.length > 0) {
    await prisma.report.deleteMany({ where: { targetPostId: { in: memberPostIds } } });
    await prisma.post.deleteMany({ where: { id: { in: memberPostIds } } });
  }

  await prisma.emailVerificationToken.create({
    data: {
      userId: member.id,
      email: member.email,
      tokenHash: hashEmailVerificationToken(rawToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto(`/verify-email?token=${encodeURIComponent(rawToken)}&next=${encodeURIComponent("/onboarding?step=3")}`);

  await expect(page.getByTestId("onboarding-first-action-card")).toBeVisible();
  await page.getByRole("link", { name: /share something small/i }).click();
  await expect(page).toHaveURL(/\/home\?compose=1&firstPost=1$/);

  const composerInput = page.getByTestId("home-composer").locator("textarea[name='contentText']");
  await expect(composerInput).toBeFocused();
  await expect(composerInput).toHaveAttribute("placeholder", "Say something simple. No need to impress.");
  await expect(page.getByTestId("media-composer-suggestions")).toBeVisible();
  await page.getByTestId("media-composer-suggestion-0").click();
  await expect(composerInput).toHaveValue(/just arrived and saying hi\./i);
  await page.getByRole("button", { name: /^share$/i }).click();

  await expect(page).toHaveURL(/\/home\?saved=first-post$/);
  await expect(page.getByTestId("home-save-message")).toContainText(/you’re now part of the circle/i);
  await expect(page.getByTestId("home-recent-activity")).toContainText(/responses will appear here/i);
  await expect(page.getByTestId("home-first-post-follow-up")).toBeVisible();
  await expect(page.getByTestId("home-first-action-card")).toHaveCount(0);
});

test("verified members regain posting and messaging while unverified members stay gated", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto("/home");
  await expect(page.getByText(/verify your email before posting/i)).toBeVisible();

  await page.goto(`/posts/${seed.posts.reportedPost.id}`);
  await expect(page.getByText(/verify your email before replying/i)).toBeVisible();

  await prisma.user.update({
    where: { email: seed.users.owner.email },
    data: { emailVerified: null },
  });

  await page.context().clearCookies();
  await loginAs(page, seed.users.owner.email, seed.password);
  await page.goto(`/chats/${seed.conversations!.approvedConversation.id}`);
  await expect(page.getByTestId("chat-composer-blocked")).toContainText(/verify your email before sending messages/i);

  const responseStatus = await page.evaluate(async (conversationId) => {
    const response = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Should fail while unverified", attachments: [] }),
    });

    return response.status;
  }, seed.conversations!.approvedConversation.id);

  expect(responseStatus).toBe(403);

  await prisma.user.update({
    where: { email: seed.users.owner.email },
    data: { emailVerified: new Date() },
  });

  await page.context().clearCookies();
  await loginAs(page, seed.users.owner.email, seed.password);
  await page.goto(`/chats/${seed.conversations!.approvedConversation.id}`);
  await expect(page.getByTestId("chat-composer-blocked")).toHaveCount(0);
  await expect(page.locator("textarea").last()).toBeVisible();
});

test("email verification UI can still be hidden when the feature flag is disabled", async ({ page }) => {
  const seed = await loginAsAdminAndSetEmailFlag(page, false);
  await page.context().clearCookies();
  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto("/settings");

  await expect(page.getByRole("button", { name: /send verification email/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /update email/i })).toHaveCount(0);
});
