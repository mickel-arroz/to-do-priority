import { expect, test } from "@playwright/test";

test.describe("mobile navigation", () => {
  test("bottom navbar connects the sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("sidebar")).toBeHidden();
    await expect(page.getByTestId("bottom-nav")).toBeVisible();

    // Lists connector page
    await page.getByTestId("nav-lists").click();
    await expect(page).toHaveURL(/\/lists/);
    await expect(page.getByTestId("lists-page")).toBeVisible();

    // Tapping a list opens its detail
    await page.getByTestId(/list-link-/).first().click();
    await expect(page).toHaveURL(/\/categories\//);
    await expect(page.getByTestId("category-page")).toBeVisible();
  });

  test("hamburger menu opens and closes with a second tap", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("nav-menu").click();
    await expect(page.getByTestId("mobile-menu")).toBeVisible();
    await expect(page.getByTestId("sign-out")).toBeVisible();

    await page.getByTestId("nav-menu").click();
    await expect(page.getByTestId("mobile-menu")).toBeHidden();
  });
});
