import { expect, test, type Browser, type Page } from "@playwright/test";
import { loadSeedData, loginAs, resetE2EState, type SeedData, type SeedUser } from "./helpers";

const TEST_EMAILS = {
  male1: "test.male1@evyta.dev",
  female1: "test.female1@evyta.dev",
  male2: "test.male2@evyta.dev",
  female2: "test.female2@evyta.dev",
  user: "test.user@evyta.dev",
} as const;

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

async function loginDefaultTestUser(page: Page, email: string) {
  const seed = loadSeedData();
  await loginAs(page, email, seed.defaultTestUserPassword);
}

async function createBuddyConversation(browser: Browser) {
  const seed = loadSeedData();
  const male1 = findDefaultUser(seed, TEST_EMAILS.male1);
  const seekerContext = await browser.newContext();
  const buddyContext = await browser.newContext();
  const seekerPage = await seekerContext.newPage();
  const buddyPage = await buddyContext.newPage();

  await loginAs(seekerPage, seed.users.member.email, seed.password);
  await seekerPage.goto("/buddy/new");
  await seekerPage.getByRole("combobox").first().selectOption("EMOTIONAL_SUPPORT");
  await seekerPage.getByPlaceholder(/share a little context/i).fill("Looking for grounded support while starting over.");
  await seekerPage.getByRole("button", { name: /submit buddy request/i }).click();
  await expect(seekerPage).toHaveURL(/\/buddy\?saved=request-submitted$/);

  await loginDefaultTestUser(buddyPage, male1.email);
  await buddyPage.goto("/buddy");
  await expect(buddyPage.getByText(seed.users.member.displayName)).toBeVisible();
  await buddyPage.getByRole("button", { name: /accept as buddy/i }).first().click();
  await expect(buddyPage).toHaveURL(/\/buddy\/.+\?saved=assigned$/);
  const buddyUrl = buddyPage.url();
  const conversationId = buddyUrl.split("/buddy/")[1].split("?")[0];

  return { seed, seekerContext, buddyContext, seekerPage, buddyPage, conversationId };
}

test("members can opt into Buddy availability and choose Buddy domains", async ({ page }) => {
  const seed = loadSeedData();
  const female2 = findDefaultUser(seed, TEST_EMAILS.female2);
  await loginAs(page, female2.email, seed.defaultTestUserPassword);
  await page.goto("/settings#buddy-setup");

  await page.getByLabel(/make me available as a buddy/i).check();
  await page.getByLabel(/short buddy intro/i).fill("Available for careful, calm peer support.");
  await page.getByRole("combobox", { name: /availability level/i }).selectOption("STANDARD");
  await page.getByLabel(/divorce support/i).check();
  await page.getByLabel(/someone to talk to/i).check();
  await page.getByRole("button", { name: /save buddy profile/i }).click();

  await expect(page).toHaveURL(/\/settings\?saved=buddy$/);
  await expect(page.getByText(/buddy profile saved/i)).toBeVisible();

  await page.goto("/buddy");
  await expect(page.getByText(/available as a buddy/i)).toBeVisible();
  await expect(page.getByText(/divorce support/i)).toBeVisible();
  await expect(page.getByText(/someone to talk to/i)).toBeVisible();
});

test("Buddy requests route only to matching Buddies and first accept wins", async ({ browser, page }) => {
  test.setTimeout(60_000);
  const seed = loadSeedData();
  const male1 = findDefaultUser(seed, TEST_EMAILS.male1);
  const female1 = findDefaultUser(seed, TEST_EMAILS.female1);
  const male2 = findDefaultUser(seed, TEST_EMAILS.male2);
  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto("/buddy/new");
  await expect(page.getByText(male1.displayName)).toHaveCount(0);
  await expect(page.getByText(female1.displayName)).toHaveCount(0);
  await page.getByRole("combobox").first().selectOption("EMOTIONAL_SUPPORT");
  await page.getByPlaceholder(/share a little context/i).fill("I could use grounded support.");
  await page.getByRole("button", { name: /submit buddy request/i }).click();
  await expect(page).toHaveURL(/\/buddy\?saved=request-submitted$/);

  const matchingBuddyContext = await browser.newContext();
  const matchingBuddyPage = await matchingBuddyContext.newPage();
  const unrelatedBuddyContext = await browser.newContext();
  const unrelatedBuddyPage = await unrelatedBuddyContext.newPage();
  const secondMatchingContext = await browser.newContext();
  const secondMatchingPage = await secondMatchingContext.newPage();

  try {
    await loginDefaultTestUser(matchingBuddyPage, male1.email);
    await matchingBuddyPage.goto("/buddy");
    await expect(matchingBuddyPage.getByText(seed.users.member.displayName)).toBeVisible();

    await loginDefaultTestUser(unrelatedBuddyPage, male2.email);
    await unrelatedBuddyPage.goto("/buddy");
    await expect(unrelatedBuddyPage.getByText(seed.users.member.displayName)).toHaveCount(0);

    await loginDefaultTestUser(secondMatchingPage, female1.email);
    await secondMatchingPage.goto("/buddy");
    await expect(secondMatchingPage.getByText(seed.users.member.displayName)).toBeVisible();

    await matchingBuddyPage.getByRole("button", { name: /accept as buddy/i }).first().click();
    await expect(matchingBuddyPage).toHaveURL(/\/buddy\/.+\?saved=assigned$/);

    await secondMatchingPage.reload();
    await expect(secondMatchingPage.getByText(/no longer relevant/i)).toBeVisible();

    await page.reload();
    await expect(page.getByRole("link", { name: /open buddy chat/i })).toBeVisible();
    await page.goto("/chats");
    await expect(page.getByText(/no conversations yet/i)).toBeVisible();
  } finally {
    await Promise.allSettled([
      matchingBuddyContext.close(),
      unrelatedBuddyContext.close(),
      secondMatchingContext.close(),
    ]);
  }
});

test("Buddy video requires separate approval and ending the connection revokes access", async ({ browser }) => {
  const { seekerContext, buddyContext, seekerPage, buddyPage, conversationId } = await createBuddyConversation(browser);

  try {
    await seekerPage.goto(`/buddy/${conversationId}`);
    await expect(seekerPage.getByText(/video calls require separate approval/i)).toBeVisible();
    await expect(seekerPage.getByTestId("start-buddy-video-call-button")).toHaveCount(0);

    const deniedStatus = await seekerPage.evaluate(async (activeConversationId) => {
      const response = await fetch("/api/buddy-video/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConversationId }),
      });
      return response.status;
    }, conversationId);
    expect(deniedStatus).toBe(403);

    await seekerPage.getByRole("button", { name: /request buddy video approval/i }).click();
    await expect(seekerPage.getByText(/buddy video request sent/i)).toBeVisible();

    await buddyPage.goto(`/buddy/${conversationId}`);
    await expect(buddyPage.getByRole("button", { name: /approve video/i })).toBeVisible();
    await buddyPage.getByRole("button", { name: /approve video/i }).click();
    await expect(buddyPage.getByText(/buddy video approved/i)).toBeVisible();

    await seekerPage.reload();
    await expect(seekerPage.getByTestId("start-buddy-video-call-button")).toBeVisible();

    const approvedStatus = await seekerPage.evaluate(async (activeConversationId) => {
      const response = await fetch("/api/buddy-video/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConversationId }),
      });
      return response.status;
    }, conversationId);
    expect(approvedStatus).toBe(200);

    await seekerPage.getByRole("button", { name: /end buddy connection/i }).click();
    await expect(seekerPage).toHaveURL(/\/buddy\?saved=connection-ended$/);

    const revokedStatus = await seekerPage.evaluate(async (activeConversationId) => {
      const response = await fetch("/api/buddy-video/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConversationId }),
      });
      return response.status;
    }, conversationId);
    expect(revokedStatus).toBe(403);

    await buddyPage.goto(`/buddy/${conversationId}`);
    await expect(buddyPage.getByText(/not found|could not be found/i)).toBeVisible();
  } finally {
    await seekerContext.close();
    await buddyContext.close();
  }
});

test("Buddy expiry prompts extension and stale open requests auto-cancel", async ({ page }) => {
  const seed = loadSeedData();
  const testUser = findDefaultUser(seed, TEST_EMAILS.user);
  await loginAs(page, testUser.email, seed.defaultTestUserPassword);
  await page.goto("/buddy");

  await expect(page.getByText(/looking for some calm peer support/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /extend request/i })).toBeVisible();
  await expect(page.getByText(/need a sounding board after a difficult breakup/i)).toHaveCount(0);

  await page.getByRole("button", { name: /extend request/i }).click();
  await expect(page).toHaveURL(/\/buddy\?saved=request-extended$/);
  await expect(page.getByText(/request was extended/i)).toBeVisible();
});
