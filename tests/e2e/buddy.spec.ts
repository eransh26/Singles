import { expect, test } from "@playwright/test";
import { loadSeedData, loginAs, resetE2EState, type SeedData, type SeedUser } from "./helpers";

const TEST_EMAILS = {
  male1: "test.male1@evyta.dev",
  female1: "test.female1@evyta.dev",
  male2: "test.male2@evyta.dev",
  female2: "test.female2@evyta.dev",
  user: "test.user@evyta.dev",
} as const;

const PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0nQAAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(() => {
  resetE2EState();
});

function findDefaultUser(seed: SeedData, email: string): SeedUser {
  const user = seed.users.defaultTestUsers?.find((entry) => entry.email === email);
  if (!user) {
    throw new Error(`Seeded default test user not found for ${email}`);
  }
  return user;
}

async function loginDefaultTestUser(page: import("@playwright/test").Page, email: string) {
  const seed = loadSeedData();
  await loginAs(page, email, seed.defaultTestUserPassword);
}

async function openBuddyApplicationForVerifiedUser(page: import("@playwright/test").Page) {
  const seed = loadSeedData();
  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/settings#buddy-setup");
  const applicationForm = page.locator("form").filter({ has: page.getByRole("button", { name: /submit buddy application/i }) }).first();
  await expect(applicationForm).toBeVisible();
  return { seed, applicationForm };
}

test("non-verified users are blocked from starting a Buddy application", async ({ page }) => {
  const seed = loadSeedData();
  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto("/settings#buddy-setup");

  await expect(page.getByText(/finish verification first to start a buddy application/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /submit buddy application/i })).toHaveCount(0);
});

test("low-trust verified users are blocked from starting a Buddy application", async ({ page }) => {
  const seed = loadSeedData();
  await loginAs(page, seed.users.lowTrust!.email, seed.password);
  await page.goto("/settings#buddy-setup");

  await expect(page.getByText(/buddy applications require more established trust first/i)).toBeVisible();
  await expect(page.getByText(/build more healthy activity before applying/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /submit buddy application/i })).toHaveCount(0);
});

test("verified users can start a Buddy application and only eligible connected verified users appear as recommenders", async ({ page }) => {
  const { applicationForm } = await openBuddyApplicationForVerifiedUser(page);

  await applicationForm.getByLabel(/short buddy intro/i).fill("I can offer calm, discreet peer support after separation and life changes.");
  await applicationForm.getByRole("combobox", { name: /availability level/i }).selectOption("STANDARD");
  await applicationForm.getByLabel(/emotional support/i).check();

  const firstRecommendationSelect = applicationForm.locator('select[name^="recommendation-"]').first();
  await expect(firstRecommendationSelect.locator("option").filter({ hasText: "Eitan Vale" })).toHaveCount(1);
  await expect(firstRecommendationSelect.locator("option").filter({ hasText: "Lia Morel" })).toHaveCount(1);
  await expect(firstRecommendationSelect.locator("option").filter({ hasText: "Maya Sol" })).toHaveCount(1);
  await expect(firstRecommendationSelect.locator("option").filter({ hasText: "Noam Darel" })).toHaveCount(0);
  await expect(firstRecommendationSelect.locator("option").filter({ hasText: "Member Uno" })).toHaveCount(0);

  await applicationForm.locator('select[name^="recommendation-"]').nth(0).selectOption({ label: "Eitan Vale" });
  await applicationForm.locator('select[name^="recommendation-"]').nth(1).selectOption({ label: "Lia Morel" });
  await applicationForm.getByRole("button", { name: /submit buddy application/i }).click();

  await expect(page).toHaveURL(/saved=buddy-application-submitted/);
  await expect(page.getByText(/active buddy application/i)).toBeVisible();
  await expect(page.locator("p").filter({ hasText: /Submitted/i }).first()).toBeVisible();
  await expect(page.getByText(/emotional support/i)).toBeVisible();
  await expect(page.getByText(/pending_recommendations/i)).toBeVisible();
});

test("declined Buddy recommendations stay in history and can be replaced", async ({ browser, page }) => {
  const { seed, applicationForm } = await openBuddyApplicationForVerifiedUser(page);
  const male1 = findDefaultUser(seed, TEST_EMAILS.male1);

  await applicationForm.getByLabel(/short buddy intro/i).fill("I can offer calm, discreet peer support after separation and life changes.");
  await applicationForm.getByRole("combobox", { name: /availability level/i }).selectOption("STANDARD");
  await applicationForm.getByLabel(/emotional support/i).check();
  await applicationForm.locator('select[name^="recommendation-"]').nth(0).selectOption({ label: "Eitan Vale" });
  await applicationForm.locator('select[name^="recommendation-"]').nth(1).selectOption({ label: "Lia Morel" });
  await applicationForm.getByRole("button", { name: /submit buddy application/i }).click();
  await expect(page).toHaveURL(/saved=buddy-application-submitted/);

  const recommenderContext = await browser.newContext();
  const recommenderPage = await recommenderContext.newPage();
  try {
    await loginDefaultTestUser(recommenderPage, male1.email);
    await recommenderPage.goto("/buddy");
    await expect(recommenderPage.getByText(seed.users.verified.displayName)).toBeVisible();
    await recommenderPage.getByLabel(/admin-only note/i).first().fill("I am not comfortable recommending this domain.");
    await recommenderPage.getByRole("button", { name: /decline recommendation/i }).first().click();
    await expect(recommenderPage).toHaveURL(/saved=buddy-recommendation-submitted/);
  } finally {
    await recommenderContext.close();
  }

  await page.goto("/settings#buddy-setup");
  await expect(page.getByText(/replacement_needed/i)).toBeVisible();
  await expect(page.getByText(/eitan vale/i)).toBeVisible();
  await expect(page.getByRole("combobox", { name: /replace declined recommender/i })).toBeVisible();
  await page.getByRole("combobox", { name: /replace declined recommender/i }).selectOption({ label: "Maya Sol" });
  await page.getByRole("button", { name: /request replacement/i }).click();
  await expect(page).toHaveURL(/saved=buddy-recommender-replaced/);
  await expect(page.getByText(/replacement recommender requested/i)).toBeVisible();
});

test("admins can review Buddy application domains independently and inactive domains disappear from new applications", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);
  await page.goto("/admin/buddy");
  await expect(page.getByTestId("admin-buddy-applications")).toContainText(seed.users.owner.displayName);
  await expect(page.getByTestId("admin-buddy-applications")).toContainText(/Trust\s+(LOW|NORMAL|HIGH)/i);
  await expect(page.getByText(/pending_admin_review/i)).toHaveCount(2);

  const applicationCard = page.locator('[data-testid="admin-buddy-applications"] article').filter({ hasText: seed.users.owner.displayName }).first();
  await applicationCard.getByRole("button", { name: /approve domain/i }).first().click();
  await expect(page).toHaveURL(/saved=buddy-application-review/);

  await page.goto("/admin/buddy");
  const refreshedApplicationCard = page.locator('[data-testid="admin-buddy-applications"] article').filter({ hasText: seed.users.owner.displayName }).first();
  await refreshedApplicationCard.getByRole("button", { name: /reject domain/i }).first().click();
  await expect(page).toHaveURL(/saved=buddy-application-review/);

  await page.goto("/admin/buddy");
  const emotionalDomainForm = page.locator('[data-testid="admin-buddy-domains"] form').filter({ has: page.locator('input[name="name"][value="Emotional support"]') }).first();
  await expect(emotionalDomainForm).toBeVisible();
  await emotionalDomainForm.locator('input[name="isActive"]').uncheck();
  await emotionalDomainForm.getByRole("button", { name: /update domain/i }).click();
  await expect(page).toHaveURL(/saved=buddy-domain/);

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto("/settings#buddy-setup");
  await expect(page.getByLabel(/^emotional support$/i)).toHaveCount(0);
});

test("domains blocked by the 3-attempt limit are not available for a new Buddy application", async ({ page }) => {
  const seed = loadSeedData();
  const testUser = findDefaultUser(seed, TEST_EMAILS.user);
  await loginAs(page, testUser.email, seed.defaultTestUserPassword);
  await page.goto("/settings#buddy-setup");

  await expect(page.getByText(/some domains need admin approval before you can apply again/i)).toBeVisible();
  await expect(page.getByText(/relationship support/i)).toBeVisible();
  await expect(page.getByLabel(/^relationship support$/i)).toHaveCount(0);
});

test("sensitive posts keep text visible and gate image reveal through the validation route", async ({ page }) => {
  const seed = loadSeedData();
  await loginAs(page, seed.users.owner.email, seed.password);
  await page.goto("/home");

  await page.getByPlaceholder(/what would you like to share/i).fill("Sensitive post text should stay readable in the feed.");
  await page.getByLabel(/sensitive image/i).check();
  await page.locator('input[name="imageAttachment"]').setInputFiles({
    name: "sensitive.png",
    mimeType: "image/png",
    buffer: PNG_BUFFER,
  });
  await page.getByRole("button", { name: /^post$/i }).click();

  await expect(page.getByText(/sensitive post text should stay readable in the feed/i)).toBeVisible();
  const sensitiveLink = page.locator('a[href*="/validation/sensitive-content"]').first();
  await expect(sensitiveLink).toBeVisible();
  await expect(sensitiveLink.getByText(/sensitive image/i)).toBeVisible();
  await expect(sensitiveLink.locator("img")).toHaveClass(/blur-xl/);

  await sensitiveLink.click();
  await expect(page).toHaveURL(/\/validation\/sensitive-content\?postId=/);
  await expect(page.getByText(/verification is required before viewing sensitive images/i)).toBeVisible();
});
