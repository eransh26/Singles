import { expect, test } from "@playwright/test";
import { loadSeedData, loginAs, resetE2EState } from "./helpers";

test.beforeEach(() => {
  resetE2EState();
});

test("approved private chats support send, multiline messages, and emoji picker dismissal", async ({ page }) => {
  const seed = loadSeedData();
  const conversationId = seed.conversations.approvedConversation.id;

  await loginAs(page, seed.users.owner.email, seed.password);
  await page.goto(`/chats/${conversationId}`);

  const composer = page.getByPlaceholder(/Write a message to/i);
  await composer.click();
  await composer.type("First line");
  await page.keyboard.down("Shift");
  await page.keyboard.press("Enter");
  await page.keyboard.up("Shift");
  await composer.type("Second line");

  await page.getByTitle("Insert emoji").click();
  await expect(page.getByPlaceholder("Search emoji")).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(page.getByPlaceholder("Search emoji")).toHaveCount(0);

  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText("First line").last()).toBeVisible();
  await expect(page.locator("text=Second line").last()).toBeVisible();
});

test("chat attachments reject unsupported files cleanly", async ({ page }) => {
  const seed = loadSeedData();
  const conversationId = seed.conversations.approvedConversation.id;

  await loginAs(page, seed.users.owner.email, seed.password);
  await page.goto(`/chats/${conversationId}`);

  const fileInput = page.locator('input[type="file"]').nth(1);
  await fileInput.setInputFiles({
    name: "malware.exe",
    mimeType: "application/x-msdownload",
    buffer: Buffer.from("not-supported"),
  });

  await expect(page.getByText(/not a supported file type/i)).toBeVisible();
});

test("video calls require separate approval even for approved chats", async ({ page }) => {
  const seed = loadSeedData();
  const conversationId = seed.conversations.approvedConversation.id;

  await loginAs(page, seed.users.owner.email, seed.password);
  await page.goto(`/chats/${conversationId}`);

  await expect(page.getByRole("button", { name: /request video approval/i })).toBeVisible();
  await expect(page.getByTestId("start-video-call-button")).toHaveCount(0);

  const responseStatus = await page.evaluate(async (activeConversationId) => {
    const response = await fetch("/api/video/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: activeConversationId }),
    });

    return response.status;
  }, conversationId);

  expect(responseStatus).toBe(403);
});

test("video approval can be granted separately and chat revocation removes access", async ({ browser, page }) => {
  const seed = loadSeedData();
  const conversationId = seed.conversations.approvedConversation.id;

  await loginAs(page, seed.users.owner.email, seed.password);
  await page.goto(`/chats/${conversationId}`);
  await page.getByRole("button", { name: /request video approval/i }).click();
  await expect(page.getByText(/video request pending/i)).toBeVisible();

  const approverContext = await browser.newContext();
  const approverPage = await approverContext.newPage();
  try {
    await loginAs(approverPage, seed.users.verified.email, seed.password);
    await approverPage.goto(`/chats/${conversationId}`);
    await expect(approverPage.getByRole("button", { name: /approve video/i })).toBeVisible();
    await approverPage.getByRole("button", { name: /approve video/i }).click();
    await expect(approverPage.getByText(/video approved/i)).toBeVisible();
  } finally {
    await approverContext.close();
  }

  await page.reload();
  await expect(page.getByTestId("start-video-call-button")).toBeVisible();
  await expect(page.getByTestId("start-video-call-button")).toContainText(/start video call/i);

  await page.getByRole("button", { name: /revoke chat/i }).click();
  await expect(page).toHaveURL(/\/chats\?saved=chat-revoked$/);
  await expect(page.getByText(/chat access was revoked/i)).toBeVisible();

  const responseStatus = await page.evaluate(async (activeConversationId) => {
    const response = await fetch("/api/video/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: activeConversationId }),
    });

    return response.status;
  }, conversationId);

  expect(responseStatus).toBe(403);
});

test("members can report a message and owners can remove their own message with a placeholder", async ({ browser, page }) => {
  const seed = loadSeedData();
  const conversationId = seed.conversations.approvedConversation.id;

  await loginAs(page, seed.users.verified.email, seed.password);
  await page.goto(`/chats/${conversationId}`);
  await page.getByRole("button", { name: /^Report$/ }).first().click();
  await page.getByRole("combobox").selectOption("SPAM");
  await page.getByPlaceholder(/optional details/i).fill("Seeded message looks suspicious.");
  await page.getByRole("button", { name: /^Submit$/ }).click();
  await expect(page.getByText(/report submitted/i)).toBeVisible();

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  try {
    await loginAs(ownerPage, seed.users.owner.email, seed.password);
    await ownerPage.goto(`/chats/${conversationId}`);
    await ownerPage.getByRole("button", { name: /^Remove$/ }).first().click();
    await expect(ownerPage.getByText(/this content was removed/i).first()).toBeVisible();
  } finally {
    await ownerContext.close();
  }
});

test("non-participants are rejected from private video access", async ({ page }) => {
  const seed = loadSeedData();
  const conversationId = seed.conversations.approvedConversation.id;

  await loginAs(page, seed.users.member.email, seed.password);

  const responseStatus = await page.evaluate(async (activeConversationId) => {
    const response = await fetch("/api/video/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: activeConversationId }),
    });

    return response.status;
  }, conversationId);
  expect(responseStatus).toBe(403);

  await page.goto(`/video/${conversationId}`);
  await expect(page.getByText(/not found|could not be found/i)).toBeVisible();
});
