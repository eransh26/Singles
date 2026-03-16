import { expect, test } from "@playwright/test";
import { loadSeedData, loginAs, resetE2EState } from "./helpers";

test.beforeEach(() => {
  resetE2EState();
});

test("credentials sign-in reaches the authenticated home page", async ({ page }) => {
  const seed = loadSeedData();

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(seed.users.member.email);
  await page.getByPlaceholder("Password").fill(seed.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByPlaceholder("What would you like to share?")).toBeVisible();
  await expect(page.getByText(seed.users.member.displayName).first()).toBeVisible();
});

test("protected routes redirect anonymous visitors to sign in", async ({ page }) => {
  await page.goto("/home");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Evyta access")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("non-admin users are redirected away from admin routes", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.member.email, seed.password);
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByPlaceholder("What would you like to share?")).toBeVisible();
});

test("admins sign in directly into the admin dashboard", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);

  await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
  await expect(page.getByTestId("admin-sidebar-users")).toBeVisible();
  await expect(page.getByTestId("admin-sidebar-admin-users")).toBeVisible();
  await expect(page.getByTestId("admin-sidebar-verifications")).toBeVisible();
  await expect(page.getByTestId("admin-sidebar-audit-logs")).toBeVisible();
});

test("admins are redirected away from the member-facing app", async ({ page }) => {
  const seed = loadSeedData();

  await loginAs(page, seed.users.admin.email, seed.password, /\/admin$/);
  await page.goto("/home");

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
});
