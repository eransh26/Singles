import { readFileSync } from "node:fs";
import path from "node:path";
import { NotificationType, PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { getPushPayload } from "../../src/lib/notification-definitions";
import { getPushBatchCountForNotification, hasRecentDeliveredBatchForNotification, shouldSuppressNotificationForActivity } from "../../src/lib/notifications";
import { loadSeedData, loginAs, resetE2EState } from "./helpers";

function getE2EDatabaseUrl() {
  if (process.env.E2E_DATABASE_URL) {
    return process.env.E2E_DATABASE_URL;
  }

  const envPath = path.resolve(process.cwd(), ".env");
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith("E2E_DATABASE_URL=")) {
      continue;
    }

    return line.slice("E2E_DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
  }

  throw new Error("Missing E2E_DATABASE_URL for notification tests.");
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: getE2EDatabaseUrl() },
  },
});

test.beforeEach(() => {
  resetE2EState();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("chat requests create an unread notification that can be marked read", async ({ browser, page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.owner.email, seed.password);
  await page.goto(`/users/${seed.users.member.id}`);
  await page.getByRole("button", { name: /send chat request/i }).click();
  await expect(page.getByText(/chat request sent/i)).toBeVisible();

  const recipientContext = await browser.newContext();
  const recipientPage = await recipientContext.newPage();
  try {
    await loginAs(recipientPage, seed.users.member.email, seed.password);
    await expect(recipientPage.getByLabel("Notifications").getByText("1")).toBeVisible();

    await recipientPage.goto("/notifications");
    await expect(recipientPage.getByText(/new chat request/i)).toBeVisible();
    await expect(recipientPage.getByText(/unread 1/i)).toBeVisible();

    await recipientPage.getByRole("button", { name: /mark read/i }).first().click();
    await expect(recipientPage.getByText(/unread 0/i)).toBeVisible();
  } finally {
    await recipientContext.close();
  }
});

test("new messages and approved video requests create discreet notifications", async ({ browser, page }) => {
  const seed = loadSeedData();
  const conversationId = seed.conversations.approvedConversation.id;

  await loginAs(page, seed.users.owner.email, seed.password);
  await page.goto(`/chats/${conversationId}`);
  await page.getByPlaceholder(/write a message to/i).fill("Checking in quietly.");
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText("Checking in quietly.").last()).toBeVisible();
  await page.getByRole("button", { name: /request video approval/i }).click();
  await expect(page.getByText(/video request pending/i)).toBeVisible();

  const recipientContext = await browser.newContext();
  const recipientPage = await recipientContext.newPage();
  try {
    await loginAs(recipientPage, seed.users.verified.email, seed.password);
    await recipientPage.goto("/notifications");
    await expect(recipientPage.getByText("New message", { exact: true })).toBeVisible();

    await recipientPage.goto(`/chats/${conversationId}`);
    await recipientPage.getByRole("button", { name: /approve video/i }).click();
    await expect(recipientPage.getByText(/video approved/i)).toBeVisible();
  } finally {
    await recipientContext.close();
  }

  await page.goto("/notifications");
  await expect(page.getByText("Video request approved", { exact: true })).toBeVisible();
});

test("buddy decision-needed notifications appear after the 48-hour threshold refresh", async ({ page }) => {
  const seed = loadSeedData();
  const buddyTestUser = seed.users.defaultTestUsers.find((entry) => entry.email === "test.user@evyta.dev");
  if (!buddyTestUser) {
    throw new Error("Missing default Buddy test user in seed manifest.");
  }

  await loginAs(page, buddyTestUser.email, seed.defaultTestUserPassword);
  await page.goto("/buddy");
  await expect(page.getByText(/extend request/i)).toBeVisible();

  await page.goto("/notifications");
  await expect(page.getByText(/buddy request needs a decision/i)).toBeVisible();
});

test("push opt-in stays contextual and can be dismissed after meaningful chat activity", async ({ page }) => {
  const seed = loadSeedData();
  const conversationId = seed.conversations.approvedConversation.id;

  await loginAs(page, seed.users.owner.email, seed.password);
  await page.goto("/home");
  await expect(page.getByText(/want instant alerts for messages and requests/i)).toHaveCount(0);

  await page.goto(`/chats/${conversationId}`);
  await expect(page.getByText(/want instant alerts for messages and requests/i)).toHaveCount(0);
  await page.getByPlaceholder(/write a message to/i).fill("A quiet follow up for the prompt test.");
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText(/want instant alerts for messages and requests/i)).toBeVisible();

  await page.getByRole("button", { name: /dismiss instant alerts prompt/i }).click();
  await expect(page.getByText(/want instant alerts for messages and requests/i)).toHaveCount(0);

  const settings = await prisma.userSettings.findUnique({
    where: { userId: seed.users.owner.id },
    select: { pushPromptDismissedAt: true },
  });
  expect(settings?.pushPromptDismissedAt).not.toBeNull();
});

test("push subscriptions can be stored and removed from the explicit settings entry point", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto("/home");
  await expect(page.getByText(/enable instant alerts/i)).toHaveCount(0);

  await page.goto("/settings#notifications");
  await expect(page.getByRole("button", { name: /enable instant alerts/i })).toBeVisible();

  const subscribeStatus = await page.evaluate(async () => {
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://example.com/push/test-device",
        keys: { p256dh: "test-p256dh", auth: "test-auth" },
        deviceLabel: "Playwright Browser",
      }),
    });
    return response.status;
  });
  expect(subscribeStatus).toBe(200);

  await page.reload();
  await expect(page.getByText(/connected on 1 device/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /disable instant alerts/i })).toBeVisible();

  const unsubscribeStatus = await page.evaluate(async () => {
    const response = await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "https://example.com/push/test-device" }),
    });
    return response.status;
  });
  expect(unsubscribeStatus).toBe(200);

  await page.reload();
  await expect(page.getByText(/instant alerts are currently off/i)).toBeVisible();
});

test("active conversation suppresses push while keeping unread notifications", async ({ browser, page }) => {
  const seed = loadSeedData();
  const conversationId = seed.conversations.approvedConversation.id;

  const recipientContext = await browser.newContext();
  const recipientPage = await recipientContext.newPage();
  try {
    await loginAs(recipientPage, seed.users.verified.email, seed.password);
    await recipientPage.goto(`/chats/${conversationId}`);
    await recipientPage.evaluate(async ({ conversationId }) => {
      await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contextType: "CHAT_CONVERSATION",
          contextId: conversationId,
          isVisible: true,
        }),
      });
    }, { conversationId });

    await loginAs(page, seed.users.owner.email, seed.password);
    await page.goto(`/chats/${conversationId}`);
    await page.getByPlaceholder(/write a message to/i).fill("This should stay in-app only.");
    await page.getByRole("button", { name: /send/i }).click();
    await expect(page.getByText("This should stay in-app only.").last()).toBeVisible();

    await expect.poll(async () => {
      const latestNotification = await prisma.notification.findFirst({
        where: {
          userId: seed.users.verified.id,
          type: NotificationType.CHAT_MESSAGE_RECEIVED,
          payloadJson: { path: ["conversationId"], equals: conversationId },
        },
      });
      return Boolean(latestNotification);
    }).toBe(true);

    const notification = await prisma.notification.findFirst({
      where: {
        userId: seed.users.verified.id,
        type: NotificationType.CHAT_MESSAGE_RECEIVED,
        payloadJson: { path: ["conversationId"], equals: conversationId },
      },
      orderBy: { createdAt: "desc" },
    });
    const activity = await prisma.userActivityState.findUnique({ where: { userId: seed.users.verified.id } });

    expect(notification).not.toBeNull();
    expect(activity).not.toBeNull();
    expect(shouldSuppressNotificationForActivity(notification!, activity!)).toBe(true);

    await recipientPage.goto("/notifications");
    await expect(recipientPage.getByText("New message", { exact: true })).toBeVisible();
  } finally {
    await recipientContext.close();
  }
});

test("repeated messages are batched by suppressing extra pushes inside the short window", async ({ page }) => {
  const seed = loadSeedData();
  const conversationId = seed.conversations.approvedConversation.id;

  await loginAs(page, seed.users.owner.email, seed.password);
  await page.goto(`/chats/${conversationId}`);

  for (const body of ["Batch one", "Batch two", "Batch three"]) {
    await page.getByPlaceholder(/write a message to/i).fill(body);
    await page.getByRole("button", { name: /send/i }).click();
    await expect(page.getByText(body).last()).toBeVisible();
  }

  await expect.poll(async () => prisma.notification.count({
    where: {
      userId: seed.users.verified.id,
      type: NotificationType.CHAT_MESSAGE_RECEIVED,
      payloadJson: { path: ["conversationId"], equals: conversationId },
    },
  })).toBe(3);

  const notifications = await prisma.notification.findMany({
    where: {
      userId: seed.users.verified.id,
      type: NotificationType.CHAT_MESSAGE_RECEIVED,
      payloadJson: { path: ["conversationId"], equals: conversationId },
    },
    orderBy: { createdAt: "asc" },
    take: 3,
  });

  const [first, second, third] = notifications;
  await prisma.notification.update({
    where: { id: first.id },
    data: { pushDeliveredAt: first.createdAt },
  });

  expect(await getPushBatchCountForNotification(prisma, third)).toBe(3);
  expect(await hasRecentDeliveredBatchForNotification(prisma, second)).toBe(true);
  expect(await hasRecentDeliveredBatchForNotification(prisma, third)).toBe(true);
});

test("notification privacy settings persist and lock-screen payloads become generic", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto("/settings#notifications");
  await page.getByLabel(/silent mode for instant alerts/i).check();
  await page.getByLabel(/hide details on lock screen/i).check();
  await page.getByRole("button", { name: /save notification preferences/i }).click();
  await expect(page).toHaveURL(/saved=notifications/);

  await page.reload();
  await expect(page.getByLabel(/silent mode for instant alerts/i)).toBeChecked();
  await expect(page.getByLabel(/hide details on lock screen/i)).toBeChecked();

  const payload = getPushPayload(
    NotificationType.CHAT_MESSAGE_RECEIVED,
    { conversationId: seed.conversations.approvedConversation.id, messageCount: 4 },
    { hideLockScreenText: true },
  );

  expect(payload?.body).toBe("You have a new notification on Evyta");
});
