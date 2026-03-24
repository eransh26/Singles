import { expect, test } from "@playwright/test";
import { loadSeedData, loginAs, resetE2EState } from "./helpers";

test.beforeEach(() => {
  resetE2EState();
});

test("events index renders redesigned sections and event signals", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/events");

  await expect(page.getByTestId("events-page")).toBeVisible();
  await expect(page.getByTestId("events-filter-bar")).toBeVisible();
  await expect(page.getByTestId("events-section-featured")).toBeVisible();
  await expect(page.getByTestId("events-section-tonight")).toBeVisible();
  await expect(page.getByTestId("events-section-circle")).toBeVisible();
  await expect(page.locator('[data-testid="event-signal-card"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="event-card-social-signals"]:visible').first()).toContainText(/going|interested/i);
});

test("events filters switch to tonight view cleanly", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/events");

  await page.getByTestId("events-filter-tonight").click();
  await expect(page).toHaveURL(/tab=tonight/);
  await expect(page.getByTestId("events-section-tonight")).toBeVisible();
  await expect(page.getByTestId("events-section-upcoming")).toHaveCount(0);
});

test("event cards update participation state and route into thread", async ({ page }) => {
  const seed = loadSeedData();
  const eventPost = seed.posts.eventThreadPost;
  if (!eventPost) {
    throw new Error("Expected seeded event thread post.");
  }

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/events");

  const goingButton = page.getByTestId("event-card-participation-actions").getByRole("button", { name: /going/i }).first();
  await expect(goingButton).toContainText("1");
  await goingButton.click();
  await expect(goingButton).toContainText("2");
  await expect(goingButton).toHaveAttribute("data-active", "true");

  await page.getByRole("link", { name: /view thread/i }).first().click();
  await expect(page).toHaveURL(new RegExp(`/posts/${eventPost.id}`));
  await expect(page.getByTestId("post-thread-page")).toBeVisible();
});

test("mobile events keeps the compact stacked structure", async ({ page }) => {
  const seed = loadSeedData();

  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/events");

  await expect(page.getByTestId("events-page")).toBeVisible();
  await expect(page.getByTestId("events-filter-bar")).toBeVisible();
  await expect(page.getByTestId("home-bottom-nav")).toBeVisible();
  await expect(page.locator('[data-testid="event-signal-card"]:visible').first()).toBeVisible();
});
