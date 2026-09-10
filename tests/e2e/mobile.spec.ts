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

  test("the menu fills the screen down to the bottom navbar", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("nav-menu").click();
    await expect(page.getByTestId("mobile-menu")).toBeVisible();

    const sheet = page.locator('[data-slot="sheet-content"]');
    const sheetBox = (await sheet.boundingBox())!;
    const navBox = (await page.getByTestId("bottom-nav").boundingBox())!;

    // Llega al borde superior y muere justo donde empieza la barra: sin fondo
    // visible entre medias y sin taparla, que es lo que la deja pulsable.
    expect(sheetBox.y).toBeLessThanOrEqual(1);
    expect(Math.abs(sheetBox.y + sheetBox.height - navBox.y)).toBeLessThan(2);

    // Y por eso el segundo toque sigue cerrándolo.
    await page.getByTestId("nav-menu").click();
    await expect(page.getByTestId("mobile-menu")).toBeHidden();
  });

  test("navigating from the menu lands on the new route and stays", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("nav-menu").click();
    await expect(page.getByTestId("mobile-menu")).toBeVisible();

    await page.getByTestId("mobile-menu").getByRole("link", { name: /Hábitos|Habits/ }).click();
    await expect(page).toHaveURL(/\/habits/);
    await expect(page.getByTestId("habits-page")).toBeVisible();

    // Regresión de la carrera: el centinela del sheet no debe devolvernos a /
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/habits/);
  });

  test("back closes the mobile menu instead of navigating", async ({ page }) => {
    await page.goto("/");
    const url = page.url();

    await page.getByTestId("nav-menu").click();
    await expect(page.getByTestId("mobile-menu")).toBeVisible();

    await page.goBack();
    await expect(page.getByTestId("mobile-menu")).toBeHidden();
    expect(page.url()).toBe(url);
  });
});
