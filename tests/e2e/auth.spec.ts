import { expect, test } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./global-setup";

// These tests manage their own session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("authentication", () => {
  test("redirects anonymous visitors to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("rejects wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("email-input").fill(E2E_EMAIL);
    await page.getByTestId("password-input").fill("wrong-password");
    await page.getByTestId("login-submit").click();
    await expect(page.getByText(/inválidos|Invalid/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("logs in and out", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("email-input").fill(E2E_EMAIL);
    await page.getByTestId("password-input").fill(E2E_PASSWORD);
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("home")).toBeVisible({ timeout: 30_000 });

    // Sign out from the sidebar user menu (avatar is visible while collapsed)
    await page.getByTestId("user-menu-trigger").click();
    await page.getByTestId("sign-out").click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("google button points to the OAuth authorize URL", async ({ page }) => {
    await page.goto("/login");
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/auth/google")),
      page.getByTestId("google-button").click(),
    ]);
    expect(request.method()).toBe("POST");
  });

  test("API endpoints answer 401 without a session", async ({ request }) => {
    for (const path of ["/api/tasks", "/api/categories", "/api/habits"]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(401);
    }
  });
});
