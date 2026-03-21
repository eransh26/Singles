import { expect, test } from "@playwright/test";
import { loadSeedData, loginAs, resetE2EState } from "./helpers";

test.beforeEach(() => {
  resetE2EState();
});

async function openFeatureFlagsAdmin(page: import("@playwright/test").Page) {
  const seed = loadSeedData();
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

test("admin can toggle feature flags", async ({ page }) => {
  await openFeatureFlagsAdmin(page);
  await setFlagEnabled(page, "buddy_enabled", false);
  await expect(flagForm(page, "buddy_enabled").getByLabel("Enable buddy_enabled")).not.toBeChecked();

  await setFlagEnabled(page, "buddy_enabled", true);
  await expect(flagForm(page, "buddy_enabled").getByLabel("Enable buddy_enabled")).toBeChecked();
});

test("Buddy respects the feature flag in UI and direct page access", async ({ page }) => {
  const seed = await openFeatureFlagsAdmin(page);
  await setFlagEnabled(page, "buddy_enabled", false);

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/home");
  await expect(page.getByRole("link", { name: /^buddy$/i })).toHaveCount(0);
  await expect(page.getByText(/need help\? get a buddy/i)).toHaveCount(0);

  await page.goto("/settings#buddy-setup");
  await expect(page.getByText(/offer peer support in the domains you know best/i)).toHaveCount(0);

  await page.goto("/buddy");
  await expect(page.getByText(/buddy is currently unavailable/i)).toBeVisible();

  await page.goto("/buddy/new");
  await expect(page.getByText(/buddy is currently unavailable/i)).toBeVisible();
});

test("Single of the Week respects the feature flag in UI and direct page access", async ({ page }) => {
  const seed = await openFeatureFlagsAdmin(page);
  await setFlagEnabled(page, "single_of_week_enabled", false);

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/home");
  await expect(page.getByText(/^single of the week$/i)).toHaveCount(0);
  await expect(page.getByText(/apply for a weekly feature/i)).toHaveCount(0);

  await page.goto("/settings#single-of-week-link");
  await expect(page.getByText(/weekly featured member application/i)).toHaveCount(0);

  await page.goto("/single-of-the-week");
  await expect(page.getByText(/single of the week is currently unavailable/i)).toBeVisible();
});

test("R2 media pipeline flag updates the upload guidance without breaking the legacy fallback", async ({ page }) => {
  const seed = await openFeatureFlagsAdmin(page);

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/me");
  await expect(page.getByText(/Accepted formats: JPG, PNG, WEBP, GIF\. Max 5 MB\./i)).toBeVisible();

  await openFeatureFlagsAdmin(page);
  await setFlagEnabled(page, "r2_media_pipeline_enabled", true);

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/me");
  await expect(page.getByText(/Accepted formats: JPG, PNG, WEBP\. Max 5 MB\./i)).toBeVisible();

  await page.goto("/single-of-the-week");
  await expect(page.getByText(/manual review is required/i)).toBeVisible();
  await expect(page.getByText(/Accepted formats: JPG, PNG, WEBP/i)).toBeVisible();
});
