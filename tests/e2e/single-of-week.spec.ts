import { expect, test } from "@playwright/test";
import { loadSeedData, loginAs, resetE2EState } from "./helpers";

const PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0nQAAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(() => {
  resetE2EState();
});

const FEATURED_MEMBER_NAME = "Noam Darel";

async function openSingleOfWeekAdmin(page: Parameters<typeof loginAs>[0], adminEmail: string, password: string) {
  await loginAs(page, adminEmail, password, /\/admin$/);
  await page.goto("/admin/single-of-the-week");
}

async function featuredCard(page: Parameters<typeof loginAs>[0]) {
  return page.locator('[data-testid="admin-sotw-features"] article').filter({ hasText: FEATURED_MEMBER_NAME }).first();
}

test("blocked and reported users cannot apply for Single of the Week", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.blockedRequester.email, seed.password);
  await page.goto("/single-of-the-week");
  await expect(page.getByText(/applications are not available while block restrictions are active/i)).toBeVisible();

  await loginAs(page, seed.singleOfWeek!.reportedMember!.email, seed.password);
  await page.goto("/single-of-the-week");
  await expect(page.getByText(/applications are paused while a report is under review/i)).toBeVisible();
});

test("eligible verified users can save and edit their featured snapshot before lock", async ({ page }) => {
  const seed = loadSeedData();
  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/single-of-the-week");

  await page.getByLabel(/featured bio/i).fill("A discreet snapshot for the weekly feature.");
  await page.getByLabel(/interests/i).fill("Travel and wellness");
  await page.getByLabel(/hobbies/i).fill("Pilates and reading");
  await page.getByLabel(/relationship intent/i).fill("Intentional dating");
  await page.getByLabel(/preferred location/i).fill("Tel Aviv");
  await page.locator('input[name="photo-0"]').setInputFiles({
    name: "featured.png",
    mimeType: "image/png",
    buffer: PNG_BUFFER,
  });
  await page.getByRole("checkbox", { name: /i consent/i }).check();
  await page.getByRole("button", { name: /save single of the week application/i }).click();

  await expect(page).toHaveURL(/saved=application/);
  await expect(page.getByText(/current state: submitted/i)).toBeVisible();

  await page.getByLabel(/featured bio/i).fill("Updated featured snapshot copy.");
  await page.getByRole("button", { name: /save single of the week application/i }).click();
  await expect(page).toHaveURL(/saved=application/);
  await expect(page.locator('textarea[name="bio"]')).toHaveValue("Updated featured snapshot copy.");
});

test("selected applications become read-only inside the final one-day window", async ({ page }) => {
  const seed = loadSeedData();
  await loginAs(page, seed.users.owner.email, seed.password);
  await page.goto("/single-of-the-week");

  await expect(page.getByText(/editing is locked because this feature week is less than one day away/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /save single of the week application/i })).toBeDisabled();
});

test("featured card appears on home and admin can hide it immediately", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/home");
  await expect(page.getByText(/single of the week/i).first()).toBeVisible();
  await expect(page.getByText("Noam Darel")).toBeVisible();

  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);
  await page.goto("/admin/single-of-the-week");
  const featureCard = page.locator('[data-testid="admin-sotw-features"] article').filter({ hasText: "Noam Darel" }).first();
  await featureCard.getByPlaceholder(/reason for hiding/i).fill("Safety follow-up");
  await featureCard.getByRole("button", { name: /hide immediately/i }).click();
  await expect(page).toHaveURL(/saved=hidden/);

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/home");
  await expect(page.getByText("Noam Darel")).toHaveCount(0);
});

test("trusted users can send featured requests and admin metrics count them", async ({ page }) => {
  const seed = loadSeedData();
  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/home");

  await page.getByRole("button", { name: /request chat/i }).click();
  await expect(page).toHaveURL(/saved=featured-chat-request/);

  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);
  await page.goto("/admin/single-of-the-week");
  const featureCard = page.locator('[data-testid="admin-sotw-features"] article').filter({ hasText: "Noam Darel" }).first();
  await expect(featureCard.getByText(/^1$/).first()).toBeVisible();
  await expect(featureCard).toContainText("Requests");
  await expect(featureCard).toContainText("1");
});

test("target-user daily cap blocks both the featured card and non-feature profile entry points", async ({ page }) => {
  const seed = loadSeedData();
  const featuredMember = seed.users.defaultTestUsers.find((user) => user.email === "test.male2@evyta.dev");
  if (!featuredMember) throw new Error("Missing featured member seed data.");

  await openSingleOfWeekAdmin(page, seed.users.admin.email, seed.password);
  const featureCard = await featuredCard(page);
  await featureCard.getByLabel(/daily override/i).fill("1");
  await featureCard.getByRole("button", { name: /save overrides/i }).click();
  await expect(page).toHaveURL(/saved=limits/);

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/home");
  await page.getByRole("button", { name: /request chat/i }).click();
  await expect(page).toHaveURL(/saved=featured-chat-request/);

  await loginAs(page, seed.users.owner.email, seed.password);
  await page.goto(`/users/${featuredMember.id}`);
  await expect(page.getByText(/has reached the maximum number of requests/i)).toBeVisible();
  await expect(page.getByText(/request unavailable/i)).toBeVisible();
});

test("target-user weekly and monthly caps can block the featured CTA from global admin settings", async ({ page }) => {
  const seed = loadSeedData();

  await openSingleOfWeekAdmin(page, seed.users.admin.email, seed.password);
  await page.locator('input[name="targetWeeklyCap"]').fill("0");
  await page.locator('input[name="targetMonthlyCap"]').fill("0");
  await page.getByRole("button", { name: /save caps/i }).click();
  await expect(page).toHaveURL(/saved=config/);

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/home");
  await expect(page.getByText(/has reached the maximum number of requests/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /request chat/i })).toBeDisabled();
});

test("requester daily cap can block featured requests with a requester-specific message", async ({ page }) => {
  const seed = loadSeedData();

  await openSingleOfWeekAdmin(page, seed.users.admin.email, seed.password);
  await page.locator('input[name="requesterDailyCap"]').fill("0");
  await page.getByRole("button", { name: /save caps/i }).click();
  await expect(page).toHaveURL(/saved=config/);

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/home");
  await expect(page.getByText(/you have reached the maximum number of featured requests/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /request chat/i })).toBeDisabled();
});

test("requester weekly and monthly caps remain global and are not changed by target overrides", async ({ page }) => {
  const seed = loadSeedData();

  await openSingleOfWeekAdmin(page, seed.users.admin.email, seed.password);
  await page.locator('input[name="requesterWeeklyCap"]').fill("0");
  await page.locator('input[name="requesterMonthlyCap"]').fill("0");
  await page.getByRole("button", { name: /save caps/i }).click();
  await expect(page).toHaveURL(/saved=config/);
  const featureCard = await featuredCard(page);
  await featureCard.getByLabel(/daily override/i).fill("99");
  await featureCard.getByRole("button", { name: /save overrides/i }).click();
  await expect(page).toHaveURL(/saved=limits/);

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/home");
  await expect(page.getByText(/you have reached the maximum number of featured requests/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /request chat/i })).toBeDisabled();
});

test("admin can update both target-user and requester caps", async ({ page }) => {
  const seed = loadSeedData();

  await openSingleOfWeekAdmin(page, seed.users.admin.email, seed.password);
  await page.locator('input[name="targetDailyCap"]').fill("8");
  await page.locator('input[name="targetWeeklyCap"]').fill("13");
  await page.locator('input[name="targetMonthlyCap"]').fill("21");
  await page.locator('input[name="requesterDailyCap"]').fill("2");
  await page.locator('input[name="requesterWeeklyCap"]').fill("4");
  await page.locator('input[name="requesterMonthlyCap"]').fill("7");
  await page.getByRole("button", { name: /save caps/i }).click();
  await expect(page).toHaveURL(/saved=config/);
  await expect(page.locator('input[name="targetDailyCap"]')).toHaveValue("8");
  await expect(page.locator('input[name="requesterMonthlyCap"]')).toHaveValue("7");
});

test("requester caps also block non-feature profile requests to the active featured member", async ({ page }) => {
  const seed = loadSeedData();
  const featuredMember = seed.users.defaultTestUsers.find((user) => user.email === "test.male2@evyta.dev");
  if (!featuredMember) throw new Error("Missing featured member seed data.");

  await openSingleOfWeekAdmin(page, seed.users.admin.email, seed.password);
  await page.locator('input[name="requesterDailyCap"]').fill("0");
  await page.getByRole("button", { name: /save caps/i }).click();
  await expect(page).toHaveURL(/saved=config/);

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto(`/users/${featuredMember.id}`);
  await expect(page.getByText(/you have reached the maximum number of featured requests/i)).toBeVisible();
  await expect(page.getByText(/request unavailable/i)).toBeVisible();
});
