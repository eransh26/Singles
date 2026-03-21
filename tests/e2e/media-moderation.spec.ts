import { expect, test } from "@playwright/test";
import { loadSeedData, loginAs, resetE2EState } from "./helpers";

test.beforeEach(() => {
  test.setTimeout(90000);
  resetE2EState();
});

async function openFeatureFlagsAdmin(page: import("@playwright/test").Page) {
  const seed = loadSeedData();
  await page.context().clearCookies();
  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);
  await page.goto("/admin/feature-flags");
  return seed;
}

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

async function enableR2MediaPipeline(page: import("@playwright/test").Page) {
  const seed = await openFeatureFlagsAdmin(page);
  await setFlagEnabled(page, "r2_media_pipeline_enabled", true);
  return seed;
}

async function bulkReviewSelected(page: import("@playwright/test").Page, labels: string[], decision: "approve" | "reject", note: string) {
  await page.goto("/admin/media?status=pending");
  for (const label of labels) {
    await page.getByLabel(label).check();
  }
  await page.locator('#bulk-media-review-form').getByPlaceholder(/optional shared moderation note/i).fill(note);
  await page.locator('#bulk-media-review-form').getByRole("button", { name: decision === "approve" ? /approve selected/i : /reject selected/i }).click();
  await expect(page).toHaveURL(/saved=media-moderation/);
}

async function reportUserFromHome(page: import("@playwright/test").Page, reporterEmail: string, password: string, authorName: string) {
  await page.context().clearCookies();
  await loginAs(page, reporterEmail, password);
  await page.goto("/home");
  const card = page.locator("article").filter({ hasText: authorName }).first();
  await expect(card).toBeVisible();
  await card.getByTitle(/safety actions/i).click();
  await card.getByRole("button", { name: /report user/i }).click();
  await page.waitForLoadState("networkidle");
}

test("queue prioritizes featured media above profile media and shows stale indicators", async ({ page }) => {
  await enableR2MediaPipeline(page);

  await page.goto("/admin/media?status=pending");
  const cards = page.locator('[data-testid="admin-media-card"]');
  await expect(cards.first()).toContainText("Noam Darel");
  await expect(cards.nth(1)).toContainText("Verified Vera");
  await expect(cards.nth(2)).toContainText("Member Uno");

  const verifiedCard = cards.filter({ hasText: "Verified Vera" }).first();
  const memberCard = cards.filter({ hasText: "Member Uno" }).first();
  await expect(verifiedCard).toContainText(">72h");
  await expect(memberCard).toContainText(">24h");
  await expect(page.getByText("Pending total")).toBeVisible();
});

test("admin can bulk approve selected pending media", async ({ page, browser }) => {
  const seed = await enableR2MediaPipeline(page);

  await bulkReviewSelected(page, ["Select Verified Vera Profile image", "Select Noam Darel Single of the Week photo"], "approve", "Bulk approved in one pass.");

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  try {
    await loginAs(memberPage, seed.users.verified.email, seed.password);
    await memberPage.goto("/me");
    await expect(memberPage.locator('img[alt="Verified Vera profile"]').first()).toHaveAttribute("src", /\/api\/media\/profile-image\//);

    await memberPage.goto("/home");
    await expect(memberPage.locator('img[alt="Noam Darel featured photo"]')).toBeVisible();
  } finally {
    await memberContext.close();
  }
});

test("admin can bulk reject selected pending media and non-admins cannot access the queue", async ({ page }) => {
  const seed = await enableR2MediaPipeline(page);

  await bulkReviewSelected(page, ["Select Member Uno Profile image", "Select Noam Darel Single of the Week photo"], "reject", "Bulk rejected for moderation.");
  await page.goto("/admin/media?status=rejected");
  await expect(page.locator('[data-testid="admin-media-card"]').filter({ hasText: "Member Uno" }).first()).toContainText(/REJECTED/i);
  await expect(page.locator('[data-testid="admin-media-card"]').filter({ hasText: "Noam Darel" }).first()).toContainText(/REJECTED/i);

  await page.context().clearCookies();
  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/admin/media");
  await expect(page).toHaveURL(/\/home$/);
});

test("reported featured media is auto-hidden until admin restores it", async ({ browser, page }) => {
  const seed = await enableR2MediaPipeline(page);

  await page.goto("/admin/media?status=pending");
  const featuredCard = page.locator('[data-testid="admin-media-card"]').filter({ hasText: "Noam Darel" }).first();
  await featuredCard.getByPlaceholder(/optional approval note/i).fill("Approve before testing auto-hide.");
  await featuredCard.getByRole("button", { name: /approve photo/i }).click();
  await expect(page).toHaveURL(/saved=media-moderation/);

  const reporterOne = await browser.newContext();
  const reporterOnePage = await reporterOne.newPage();
  const reporterTwo = await browser.newContext();
  const reporterTwoPage = await reporterTwo.newPage();

  try {
    await reportUserFromHome(reporterOnePage, seed.users.verified.email, seed.password, "Noam Darel");
    await reportUserFromHome(reporterTwoPage, seed.users.owner.email, seed.password, "Noam Darel");
  } finally {
    await reporterOne.close();
    await reporterTwo.close();
  }

  await page.context().clearCookies();
  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/home");
  await expect(page.locator('img[alt="Noam Darel featured photo"]')).toHaveCount(0);

  await page.context().clearCookies();
  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);
  await page.goto("/admin/media?status=pending");
  const hiddenCard = page.locator('[data-testid="admin-media-card"]').filter({ hasText: "Noam Darel" }).first();
  await expect(hiddenCard).toContainText(/AUTO_HIDDEN/i);
  await expect(hiddenCard).toContainText(/Weighted signal/i);
  await expect(hiddenCard).toContainText(/Distinct reporters:/i);
  await hiddenCard.getByPlaceholder(/optional re-approval note/i).fill("Restored after manual review.");
  await hiddenCard.getByRole("button", { name: /approve and restore/i }).click();
  await expect(page).toHaveURL(/saved=media-moderation/);

  await page.context().clearCookies();
  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/home");
  await expect(page.locator('img[alt="Noam Darel featured photo"]')).toBeVisible();
});

test("reported approved profile media is hidden from public display until reviewed", async ({ browser, page }) => {
  const seed = await enableR2MediaPipeline(page);

  await page.goto("/admin/media?status=pending");
  const profileCard = page.locator('[data-testid="admin-media-card"]').filter({ hasText: "Verified Vera" }).first();
  await profileCard.getByPlaceholder(/optional approval note/i).fill("Approve before auto-hide coverage.");
  await profileCard.getByRole("button", { name: /approve image/i }).click();
  await expect(page).toHaveURL(/saved=media-moderation/);

  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  try {
    await loginAs(viewerPage, seed.users.owner.email, seed.password);
    await viewerPage.goto(`/users/${seed.users.verified.id}`);
    await expect(viewerPage.locator('img[alt="Verified Vera profile"]').first()).toHaveAttribute("src", /\/api\/media\/profile-image\//);
  } finally {
    await viewerContext.close();
  }

  const reporterOne = await browser.newContext();
  const reporterOnePage = await reporterOne.newPage();
  const reporterTwo = await browser.newContext();
  const reporterTwoPage = await reporterTwo.newPage();

  try {
    await reportUserFromHome(reporterOnePage, seed.users.owner.email, seed.password, "Verified Vera");
    await reportUserFromHome(reporterTwoPage, seed.users.member.email, seed.password, "Verified Vera");
  } finally {
    await reporterOne.close();
    await reporterTwo.close();
  }

  const postHideViewer = await browser.newContext();
  const postHidePage = await postHideViewer.newPage();
  try {
    await loginAs(postHidePage, seed.users.owner.email, seed.password);
    await postHidePage.goto(`/users/${seed.users.verified.id}`);
    await expect(postHidePage.locator('img[alt="Verified Vera profile"]').first()).toHaveAttribute("src", /avatar-neutral-2\.svg/);
  } finally {
    await postHideViewer.close();
  }

  await page.context().clearCookies();
  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);
  await page.goto("/admin/media?status=pending&type=profile");
  const hiddenProfileCard = page.locator('[data-testid="admin-media-card"]').filter({ hasText: "Verified Vera" }).first();
  await expect(hiddenProfileCard).toContainText(/AUTO_HIDDEN/i);
  await hiddenProfileCard.getByPlaceholder(/optional rejection reason/i).fill("Rejected after review.");
  await hiddenProfileCard.getByRole("button", { name: /reject image/i }).click();
  await expect(page).toHaveURL(/saved=media-moderation/);
});

