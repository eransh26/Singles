import { expect, test } from "@playwright/test";
import { loadSeedData, loginAs, resetE2EState } from "./helpers";

test.beforeEach(() => {
  resetE2EState();
  test.setTimeout(90000);
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

async function enableEmailVerificationFlag(page: import("@playwright/test").Page) {
  const seed = loadSeedData();
  await page.context().clearCookies();
  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);
  await page.goto("/admin/feature-flags");
  await setFlagEnabled(page, "email_verification_enabled", true);
  return seed;
}

test("email verification UI stays hidden while the feature flag is off", async ({ page }) => {
  const seed = loadSeedData();
  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto("/settings");

  await expect(page.getByRole("button", { name: /send verification email/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /update email/i })).toHaveCount(0);
});

test("enabled email verification resets verified state when the email is changed", async ({ page }) => {
  const seed = await enableEmailVerificationFlag(page);
  await page.context().clearCookies();
  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/settings");

  await page.getByLabel("Change email").fill("verified.updated@evyta.dev");
  await page.getByRole("button", { name: /update email/i }).click();

  await expect(page).toHaveURL(/saved=email-changed/);
  await expect(page.getByText("Not verified").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /send verification email/i })).toBeVisible();
});

test("verify-email shows a clear invalid state for a bad token when the feature is enabled", async ({ page }) => {
  await enableEmailVerificationFlag(page);
  await page.context().clearCookies();
  await page.goto("/verify-email?token=bad-token");

  await expect(page.getByRole("heading", { name: /verification link invalid/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
});
