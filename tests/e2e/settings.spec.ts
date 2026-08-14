import { expect, test } from "@playwright/test";

test.describe("theme, language, PWA and about", () => {
  test("theme toggle persists across reloads via localStorage", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("sidebar").hover();
    const html = page.locator("html");
    const wasDark = await html.evaluate((el) => el.classList.contains("dark"));

    await page.getByTestId("theme-toggle").first().click();
    await expect(html).toHaveClass(wasDark ? /^(?!.*dark)/ : /dark/, {
      timeout: 5_000,
    });

    await page.reload();
    const isDarkAfter = await html.evaluate((el) => el.classList.contains("dark"));
    expect(isDarkAfter).toBe(!wasDark);
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
      wasDark ? "light" : "dark"
    );
  });

  test("language toggle translates the UI and persists", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("sidebar").hover();

    const toggle = page.getByTestId("language-toggle").first();
    const initial = await toggle.textContent();
    await toggle.click();

    if (initial?.includes("ES")) {
      await expect(page.getByTestId("section-pending")).toContainText("Pending");
    } else {
      await expect(page.getByTestId("section-pending")).toContainText("Pendientes");
    }

    await page.reload();
    const stored = await page.evaluate(() => localStorage.getItem("locale"));
    expect(stored).toBe(initial?.includes("ES") ? "en" : "es");
  });

  test("the manifest is reachable", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();
    expect(manifest.name).toBe("To-Do Priority");
    expect(manifest.display).toBe("standalone");
  });

  test("the hidden about link opens the about page", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("sidebar").hover();
    await page.getByTestId("about-link").click();
    await expect(page.getByTestId("about-page")).toBeVisible();
  });
});
