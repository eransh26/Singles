import { expect, Page } from "@playwright/test";
import { loadSeedData, resetE2EState, type SeedData } from "./seed";

const PASSWORD = "12345678a";

export { loadSeedData, resetE2EState };
export type { SeedData };

export async function loginAs(page: Page, email: string, password = PASSWORD, expectedPath = /\/home$/) {
  await page.goto(`/login?reset=${Date.now()}`);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(expectedPath);
}

