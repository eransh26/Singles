import { expect, test } from "@playwright/test";
import { loadSeedData, loginAs, resetE2EState } from "./helpers";

test.beforeEach(() => {
  resetE2EState();
});

test("explore renders core discovery sections and trust-aware cards", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/search");

  await expect(page.getByTestId("explore-page")).toBeVisible();
  await expect(page.getByTestId("explore-filter-bar")).toBeVisible();
  await expect(page.getByTestId("explore-section-featured")).toBeVisible();
  await expect(page.getByTestId("explore-section-events")).toBeVisible();
  await expect(page.getByTestId("explore-section-people")).toBeVisible();
  await expect(page.getByTestId("explore-section-buddy")).toBeVisible();
  await expect(page.locator('[data-testid="explore-member-card"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="home-trust-badge"]:visible').first()).toBeVisible();
});

test("explore filter tabs switch to people view cleanly", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/search");

  await page.getByTestId("explore-filter-people").click();
  await expect(page).toHaveURL(/tab=people/);
  await expect(page.getByTestId("explore-section-people")).toBeVisible();
  await expect(page.getByTestId("explore-section-featured")).toHaveCount(0);
  await expect(page.getByTestId("explore-section-events")).toHaveCount(0);
});

test("explore opens profile and profile shows identity trust actions and activity", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/search");

  await page.locator('[data-testid="explore-member-card"] a', { hasText: 'View' }).first().click();
  await expect(page).toHaveURL(/\/users\//);
  await expect(page.getByTestId("profile-page")).toBeVisible();
  await expect(page.getByTestId("profile-identity-card")).toBeVisible();
  await expect(page.getByTestId("profile-action-panel")).toBeVisible();
  await expect(page.getByTestId("profile-activity-section")).toBeVisible();
  await expect(page.locator('[data-testid="home-trust-badge"]:visible').first()).toBeVisible();
});

test("profile mobile layout keeps identity and actions close together", async ({ page }) => {
  const seed = loadSeedData();

  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto(`/users/${seed.users.owner.id}`);

  await expect(page.getByTestId("profile-page")).toBeVisible();
  await expect(page.getByTestId("profile-identity-card")).toBeVisible();
  await expect(page.getByTestId("profile-action-panel")).toBeVisible();
  await expect(page.getByTestId("profile-activity-section")).toBeVisible();
});
