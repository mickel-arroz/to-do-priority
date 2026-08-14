import { expect, test as setup } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./global-setup";

const AUTH_FILE = "tests/e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("email-input").fill(E2E_EMAIL);
  await page.getByTestId("password-input").fill(E2E_PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("home")).toBeVisible({ timeout: 30_000 });
  await page.context().storageState({ path: AUTH_FILE });
});
