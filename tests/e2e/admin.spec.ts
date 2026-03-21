import { expect, test } from "@playwright/test";
import { loadSeedData, loginAs, resetE2EState } from "./helpers";

test.beforeEach(() => {
  resetE2EState();
});

test("admin can approve and reject verification requests and each action is audited", async ({ page }) => {
  test.slow();
  const seed = loadSeedData();

  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);
  await page.goto("/admin/verifications");

  const approveCard = page.getByTestId(`admin-verification-${seed.users.verificationApproveUser.id}`);
  await approveCard.getByRole("button", { name: "Approve verification" }).click();
  await expect(page.getByText("Verification review saved.")).toBeVisible();

  await page.goto("/admin/users");
  await expect(page.getByTestId(`admin-user-row-${seed.users.verificationApproveUser.id}`)).toContainText("APPROVED");

  await page.goto("/admin/verifications");
  const rejectCard = page.getByTestId(`admin-verification-${seed.users.verificationRejectUser.id}`);
  await rejectCard.getByRole("button", { name: "Reject verification" }).click();
  await expect(page.getByText("Verification review saved.")).toBeVisible();

  await page.goto("/admin/users");
  await expect(page.getByTestId(`admin-user-row-${seed.users.verificationRejectUser.id}`)).toContainText("REJECTED");

  await page.goto("/admin/audit-logs");
  await expect(page.getByTestId("admin-audit-log").getByText("admin.verification.approved")).toBeVisible();
  await expect(page.getByTestId("admin-audit-log").getByText("admin.verification.rejected")).toBeVisible();
});

test("admin can resolve a post report, hide the post, and create an audit entry", async ({ browser, page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);
  await page.goto("/admin/reports");

  const reportCard = page.getByTestId(`admin-report-${seed.reports.postReport.id}`);
  await reportCard.getByLabel("Moderation action").selectOption("HIDE_POST");
  await reportCard.getByRole("button", { name: "Resolve report" }).click();
  await expect(page.getByText("Report review saved.")).toBeVisible();

  await page.goto("/admin/audit-logs");
  await expect(page.getByTestId("admin-audit-log").getByText("admin.report.resolved")).toBeVisible();

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await loginAs(memberPage, seed.users.member.email, seed.password);
  await memberPage.goto("/home");
  await expect(memberPage.getByText(seed.posts.reportedPost.contentText)).toHaveCount(0);
  await memberContext.close();
});

test("admin can create and edit a promoted event and members see the updated home placement", async ({ browser, page }) => {
  test.slow();
  const seed = loadSeedData();
  const originalTitle = "Spring Gathering";
  const updatedTitle = "Spring Gathering Updated";

  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);
  await page.goto("/admin/events");

  const createForm = page.getByTestId("admin-event-create");
  await createForm.getByLabel("Title").fill(originalTitle);
  await createForm.getByLabel("Description").fill("A highlighted admin-managed event for the home feed.");
  await createForm.getByLabel("External link").fill("https://example.com/events/spring-gathering");
  await createForm.getByLabel("Status").selectOption("ACTIVE");
  await createForm.locator('select[name="placementType"]').selectOption("HOME_FEED_CARD");
  await createForm.getByRole("button", { name: "Save event" }).click();
  await expect(page.getByText("Promoted event saved.")).toBeVisible();

  await page.goto("/admin/audit-logs");
  await expect(page.getByTestId("admin-audit-log").getByText("admin.event.created")).toBeVisible();

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await loginAs(memberPage, seed.users.member.email, seed.password);
  await memberPage.goto("/home");
  await expect(memberPage.getByTestId("home-promoted-event")).toContainText(originalTitle);

  await page.goto("/admin/events");
  const eventForm = page
    .locator('[data-testid^="admin-event-"]')
    .filter({ hasText: originalTitle, has: page.getByRole("button", { name: "Update event" }) })
    .first();
  const titleInput = eventForm.locator('input[name="title"]');
  await titleInput.scrollIntoViewIfNeeded();
  await expect(titleInput).toBeEditable();
  await titleInput.fill(updatedTitle);
  await eventForm.getByRole("button", { name: "Update event" }).click();
  await expect(page.getByText("Promoted event saved.")).toBeVisible();

  await page.goto("/admin/audit-logs");
  await expect(page.getByTestId("admin-audit-log").getByText("admin.event.updated")).toBeVisible();

  await memberPage.goto("/home");
  await expect(memberPage.getByTestId("home-promoted-event")).toContainText(updatedTitle);
  await memberContext.close();
});

test("admin can suspend a user, mark them as a test user, and the action is audited", async ({ browser, page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);
  await page.goto("/admin/users");
  await page.getByTestId(`admin-user-toggle-${seed.users.member.id}`).click();

  const userCard = page.getByTestId(`admin-user-${seed.users.member.id}`);
  await userCard.getByLabel("Account status").selectOption("SUSPENDED");
  await userCard.getByRole("checkbox", { name: "Test user" }).check();
  await userCard.getByRole("button", { name: "Save user" }).click();
  await expect(page.getByText("User management update saved.")).toBeVisible();
  await expect(page.getByTestId(`admin-user-row-${seed.users.member.id}`)).toContainText("Yes");

  await page.goto("/admin/audit-logs");
  await expect(page.getByTestId("admin-audit-log").getByText("admin.user.updated")).toBeVisible();

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await memberPage.goto("/login");
  await memberPage.getByPlaceholder("Email").fill(seed.users.member.email);
  await memberPage.getByPlaceholder("Password").fill(seed.password);
  await memberPage.getByRole("button", { name: "Sign in" }).click();
  await expect(memberPage.getByText(/We couldn.t sign you in/)).toBeVisible();
  await memberContext.close();
});

test("a suspended user with an existing session is blocked from posting immediately", async ({ browser, page }) => {
  const seed = loadSeedData();

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await loginAs(memberPage, seed.users.member.email, seed.password);
  await memberPage.goto("/home");

  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);
  await page.goto("/admin/users");
  await page.getByTestId(`admin-user-toggle-${seed.users.member.id}`).click();

  const userCard = page.getByTestId(`admin-user-${seed.users.member.id}`);
  await userCard.getByLabel("Account status").selectOption("SUSPENDED");
  await userCard.getByRole("button", { name: "Save user" }).click();
  await expect(page.getByText("User management update saved.")).toBeVisible();

  await memberPage.goto("/home");
  await expect(memberPage).toHaveURL(/\/login\?error=account-inactive$/);

  await memberContext.close();
});

test("admin can create an additional super admin test account and it lands in the admin shell", async ({ browser, page }) => {
  const seed = loadSeedData();
  const email = `ops-${Date.now()}@example.com`;
  const password = "87654321a";

  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);
  await page.goto("/admin/operators");

  const createForm = page.getByTestId("admin-create-user-form");
  await createForm.getByLabel("Display name").fill("Operations Lead");
  await createForm.getByLabel("Email").fill(email);
  await createForm.getByLabel("Temporary password").fill(password);
  await createForm.getByLabel("Role").selectOption("SUPER_ADMIN");
  await createForm.getByRole("checkbox", { name: "Test user" }).check();
  await createForm.getByRole("button", { name: "Create admin user" }).click();

  await expect(page.getByText("Admin user created.")).toBeVisible();
  const createdRow = page.locator('tr[data-testid^="admin-user-row-"]').filter({ hasText: email }).first();
  await expect(createdRow).toContainText("Operations Lead");
  await expect(createdRow).toContainText("SUPER_ADMIN");
  await expect(createdRow).toContainText("Yes");

  await page.goto("/admin/audit-logs");
  await expect(page.getByTestId("admin-audit-log").getByText("admin.user.created")).toBeVisible();

  const newAdminContext = await browser.newContext();
  const newAdminPage = await newAdminContext.newPage();
  await loginAs(newAdminPage, email, password, /\/admin$/);
  await expect(newAdminPage.getByTestId("admin-sidebar-action-center")).toBeVisible();
  await newAdminContext.close();
});

test("admin can approve the top moderation item inline from the action center", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);

  const moderationSection = page.getByTestId("admin-action-moderation");
  const topItem = moderationSection.getByTestId("admin-action-moderation-item-0");
  const topHeading = (await topItem.getByRole("heading").textContent())?.trim();

  await topItem.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Media moderation saved.")).toBeVisible();

  if (topHeading) {
    await expect(moderationSection.getByRole("heading", { name: topHeading })).toHaveCount(0);
  }
});

test("admin can reject the top moderation item inline from the action center", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);

  const moderationSection = page.getByTestId("admin-action-moderation");
  const topItem = moderationSection.getByTestId("admin-action-moderation-item-0");
  const topHeading = (await topItem.getByRole("heading").textContent())?.trim();

  await topItem.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Media moderation saved.")).toBeVisible();

  if (topHeading) {
    await expect(moderationSection.getByRole("heading", { name: topHeading })).toHaveCount(0);
  }
});

test("non-admin users cannot access inline admin actions through the action center", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto("/admin");

  await expect(page).not.toHaveURL(/\/admin$/);
  await expect(page.getByTestId("admin-action-center")).toHaveCount(0);
});

test("admin can approve the top reviewable buddy item inline from the action center", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);

  const buddySection = page.getByTestId("admin-action-buddy");
  const topBuddyItem = buddySection.getByTestId("admin-action-buddy-item-0");
  const initialApproveCount = await buddySection.getByRole("button", { name: "Approve" }).count();

  await expect(topBuddyItem.getByRole("button", { name: "Approve" })).toBeVisible();
  await topBuddyItem.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Buddy application review saved.")).toBeVisible();
  await expect(buddySection.getByRole("button", { name: "Approve" })).toHaveCount(Math.max(0, initialApproveCount - 1));
});

test("admin action center is the default landing and dashboard remains accessible", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);

  await expect(page.getByTestId("admin-action-center")).toBeVisible();
  await expect(page.getByTestId("admin-action-needs-attention")).toBeVisible();
  await expect(page.getByTestId("admin-action-moderation")).toBeVisible();
  await expect(page.getByTestId("admin-action-buddy")).toBeVisible();
  await expect(page.getByTestId("admin-action-featured")).toBeVisible();
  await expect(page.getByTestId("admin-action-quick-actions")).toBeVisible();
  await expect(page.getByText(/Trust /).first()).toBeVisible();
  await expect(page.getByTestId("admin-action-needs-attention-item-0")).toContainText("Featured photo needs review");

  await page.getByTestId("admin-action-needs-attention").getByRole("link", { name: "Open dashboard" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByText("High-level overview")).toBeVisible();

  await page.getByTestId("admin-sidebar-action-center").click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole("link", { name: "Review next media item" }).click();
  await expect(page).toHaveURL(/\/admin\/media$/);
});


