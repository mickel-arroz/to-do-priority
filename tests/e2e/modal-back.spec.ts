import { expect, test } from "@playwright/test";

/**
 * El botón/gesto "atrás" cierra la modal de encima en vez de navegar. Se
 * prueba aquí y no en Vitest porque jsdom no despacha `popstate` de forma
 * fiable ante `history.go`. Ver `docs/adr/0006-modal-back-button.md`.
 */
test.describe("back button and modals", () => {
  test("closes the dialog instead of navigating, keeping the URL", async ({
    page,
  }) => {
    await page.goto("/habits");
    const url = page.url();

    await page.getByTestId("new-habit").click();
    await expect(page.getByTestId("habit-name-input")).toBeVisible();

    await page.goBack();
    await expect(page.getByTestId("habit-name-input")).toBeHidden();
    expect(page.url()).toBe(url);
    await expect(page.getByTestId("habits-page")).toBeVisible();
  });

  test("without modals, back still navigates", async ({ page }) => {
    await page.goto("/");
    await page.goto("/habits");
    await expect(page.getByTestId("habits-page")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("home")).toBeVisible();
  });

  test("closing with the X leaves no dead back step", async ({ page }) => {
    await page.goto("/");
    await page.goto("/habits");

    await page.getByTestId("new-habit").click();
    await expect(page.getByTestId("habit-name-input")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("habit-name-input")).toBeHidden();

    // Un solo 'atrás' tiene que salir de la página: si el centinela no se
    // hubiera consumido, este paso lo gastaría en una modal ya cerrada.
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test("stacked modals close one at a time, top first", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("new-task").click();
    await page.getByTestId("task-title-input").fill("Tarea atrás e2e");
    await page.getByTestId("task-due-input").fill(
      new Date().toISOString().slice(0, 10)
    );
    await page.getByTestId("priority-1").click();
    await page.getByTestId("task-save").click();
    await expect(page.getByText("Tarea atrás e2e").first()).toBeVisible();

    // Reabrir en modo edición: ahí vive el AlertDialog de borrar
    await page
      .getByTestId("task-title")
      .filter({ hasText: "Tarea atrás e2e" })
      .first()
      .click();
    await expect(page.getByTestId("task-title-input")).toBeVisible();

    await page.getByTestId("task-delete").click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();

    await page.goBack();
    await expect(confirm).toBeHidden();
    await expect(page.getByTestId("task-title-input")).toBeVisible();

    await page.goBack();
    await expect(page.getByTestId("task-title-input")).toBeHidden();
    await expect(page.getByTestId("home")).toBeVisible();
  });
});
