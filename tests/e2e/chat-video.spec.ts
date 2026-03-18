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

test("approved conversations show the private video call entry point", async ({ page }) => {
  const seed = loadSeedData();
  const conversationId = seed.conversations.approvedConversation.id;

  await loginAs(page, seed.users.owner.email, seed.password);
  await page.goto(`/chats/${conversationId}`);

  await expect(page.getByTestId("start-video-call-button")).toBeVisible();
  await expect(page.getByTestId("start-video-call-button")).toContainText(/video call/i);
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
