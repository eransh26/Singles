import { expect, test } from "@playwright/test";
import { loadSeedData, loginAs, resetE2EState } from "./helpers";

test.beforeEach(() => {
  resetE2EState();
});

test("home renders the new premium feed sections on desktop", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/home");

  await expect(page.getByTestId("home-top-bar")).toBeVisible();
  await expect(page.getByTestId("home-composer")).toBeVisible();
  const composerInput = page.getByTestId("home-composer").locator("textarea[name='contentText']");
  await expect(composerInput).toBeVisible();
  await composerInput.fill("Immediate home typing check");
  await expect(page.getByTestId("home-feed")).toBeVisible();
  await expect(page.locator('[data-testid="home-feed-card"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="home-trust-badge"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="home-signal-card"]:visible').first()).toBeVisible();
  await expect(page.getByTestId("home-opportunity-rail")).toBeVisible();

  const inputBox = await composerInput.boundingBox();
  expect(inputBox?.height ?? 0).toBeLessThan(90);
});

test("home keeps a mobile-first structure with bottom nav and embedded signals", async ({ page }) => {
  const seed = loadSeedData();

  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/home");

  await expect(page.getByTestId("home-top-bar")).toBeVisible();
  await expect(page.getByTestId("home-composer")).toBeVisible();
  await expect(page.getByTestId("home-bottom-nav")).toBeVisible();
  await expect(page.getByTestId("home-opportunity-rail")).not.toBeVisible();
  await expect(page.locator('[data-testid="home-signal-card"]:visible').first()).toBeVisible();

  await page.getByTestId("home-bottom-nav").getByRole("link", { name: /Explore/i }).click();
  await expect(page).toHaveURL(/\/search$/);
});

test("home composer emoji picker opens with visible emojis and does not break layout", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/home");

  const composer = page.getByTestId("home-composer");
  const composerBoxBefore = await composer.boundingBox();
  const emojiTrigger = composer.getByTitle("Insert emoji");
  await emojiTrigger.click();

  await expect(page.getByTestId("emoji-picker-panel")).toBeVisible();
  await expect(page.getByTestId("emoji-picker-tabs")).toBeVisible();
  await expect(page.getByTestId("emoji-picker-grid").locator("button").first()).toBeVisible();

  const composerBoxAfter = await composer.boundingBox();
  expect(Math.abs((composerBoxAfter?.width ?? 0) - (composerBoxBefore?.width ?? 0))).toBeLessThanOrEqual(2);

  await emojiTrigger.click();
  await expect(page.getByTestId("emoji-picker-panel")).toHaveCount(0);
});

test("home composer camera panel dismisses consistently, shows a clear close control, and returns focus", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/home");

  const captureButton = page.getByTestId("home-composer").getByTitle("Capture image");
  await captureButton.click();
  await expect(page.getByTestId("media-camera-panel")).toBeVisible();
  await expect(page.getByRole("button", { name: /close camera panel/i })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("media-camera-panel")).toHaveCount(0);
  await expect(captureButton).toBeFocused();

  await captureButton.click();
  await expect(page.getByTestId("media-camera-panel")).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(page.getByTestId("media-camera-panel")).toHaveCount(0);
});


