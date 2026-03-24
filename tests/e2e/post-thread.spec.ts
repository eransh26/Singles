import { expect, test } from "@playwright/test";
import { loadSeedData, loginAs, resetE2EState } from "./helpers";

test.beforeEach(() => {
  resetE2EState();
});

test("post thread opens from the home feed", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto("/home");

  const openThreadLink = page.getByTestId("home-feed").getByRole("link", { name: /open thread/i }).first();
  await Promise.all([page.waitForURL(/\/posts\//), openThreadLink.click()]);
  await expect(page.getByTestId("post-thread-page")).toBeVisible();
  await expect(page.getByTestId("post-thread-card")).toBeVisible();
  await expect(page.getByTestId("thread-action-bar")).toBeVisible();
});

test("support-oriented thread shows buddy handoff and thread-native buddy action", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto(`/posts/${seed.posts.reportedPost.id}`);

  await expect(page.getByTestId("post-thread-card")).toContainText(/reportable post content/i);
  await expect(page.getByTestId("thread-replies-section")).toBeVisible();
  await expect(page.getByTestId("thread-reply-row").first()).toBeVisible();
  await expect(page.getByTestId("thread-reply-composer-section")).toBeVisible();
  await expect(page.getByTestId("thread-action-bar")).toBeVisible();
  await expect(page.getByTestId("thread-event-context-panel")).toHaveCount(0);
  await expect(page.getByTestId("thread-buddy-handoff")).toBeVisible();
  await expect(page.getByTestId("thread-action-bar-buddy-link")).toBeVisible();
  await expect(page.getByText(/open to connect around this thread|quieter support handoff/i)).toBeVisible();
  await expect(page.getByTestId("home-trust-badge").first()).toBeVisible();
});

test("buddy handoff opens the existing buddy flow with thread context prefilled", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto(`/posts/${seed.posts.reportedPost.id}`);

  await page.getByTestId("thread-buddy-handoff").getByRole("link", { name: /send buddy request|open buddy/i }).click();

  await expect(page).toHaveURL(/\/buddy\/new/);
  await expect(page.getByRole("heading", { name: /ask for support without having to browse/i })).toBeVisible();
  await expect(page.locator("textarea[name='message']")).toHaveValue(/Coming from this thread:/i);
});

test("thread reply composer expands and sends a reply", async ({ page }) => {
  const seed = loadSeedData();
  const replyText = `Thread reply ${Date.now()}`;

  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto(`/posts/${seed.posts.reportedPost.id}`);

  const composer = page.getByTestId("thread-reply-composer");
  const input = page.getByTestId("thread-reply-input");

  await expect(composer).toHaveAttribute("data-expanded", "false");
  await input.fill(replyText);
  await expect(composer).toHaveAttribute("data-expanded", "true");
  await page.getByTestId("thread-reply-submit").click();

  await expect(page.getByText(replyText)).toBeVisible();
  await expect(page.getByTestId("thread-reply-status")).toContainText(/sent to the thread/i);
  await expect(input).toBeFocused();
  await input.fill("Second reply draft");
  await expect(input).toHaveValue("Second reply draft");
});

test("event-related thread shows coordination and social-proof signals without buddy clutter", async ({ page }) => {
  const seed = loadSeedData();
  const eventPost = seed.posts.eventThreadPost;
  if (!eventPost) {
    throw new Error("Expected seeded event thread post.");
  }

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto(`/posts/${eventPost.id}`);

  await expect(page.getByTestId("thread-event-context-panel")).toBeVisible();
  await expect(page.getByTestId("thread-event-participation-actions")).toBeVisible();
  await expect(page.getByTestId("thread-event-action-bar-actions")).toBeVisible();
  await expect(page.getByTestId("thread-social-signals")).toBeVisible();
  await expect(page.getByTestId("thread-social-signals")).toContainText(/circle|high-trust/i);
  await expect(page.getByTestId("thread-buddy-handoff")).toHaveCount(0);
  await expect(page.getByTestId("thread-action-bar-buddy-link")).toHaveCount(0);

  const goingButton = page.getByTestId("thread-event-participation-actions").getByRole("button", { name: /going/i });
  await expect(goingButton).toContainText("1");
  await goingButton.click();
  await expect(goingButton).toContainText("2");
  await expect(goingButton).toHaveAttribute("data-active", "true");

  await expect(page.getByTestId("thread-reply-composer")).toBeVisible();
});

test("mobile post thread keeps the composer and sticky action bar visible", async ({ page }) => {
  const seed = loadSeedData();

  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto(`/posts/${seed.posts.reportedPost.id}`);

  await expect(page.getByTestId("post-thread-page")).toBeVisible();
  await expect(page.getByTestId("thread-reply-composer")).toBeVisible();
  await expect(page.getByTestId("thread-action-bar")).toBeVisible();
});




