import { expect, test } from "@playwright/test";
import { format } from "date-fns";

const today = format(new Date(), "yyyy-MM-dd");

test.describe("tasks", () => {
  test("creates a task that appears in Pendientes ordered by priority", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("new-task").click();
    await page.getByTestId("task-title-input").fill("Tarea P2 e2e");
    await page.getByTestId("task-due-input").fill(today);
    await page.getByTestId("priority-2").click();
    await page.getByTestId("task-save").click();
    await expect(page.getByText("Tarea P2 e2e")).toBeVisible();

    await page.getByTestId("new-task").click();
    await page.getByTestId("task-title-input").fill("Tarea P1 e2e");
    await page.getByTestId("task-due-input").fill(today);
    await page.getByTestId("priority-1").click();
    await page.getByTestId("task-save").click();
    await expect(page.getByText("Tarea P1 e2e")).toBeVisible();

    // P1 renders before P2 inside Pendientes
    const titles = await page
      .getByTestId(/task-row-/)
      .getByTestId("task-title")
      .allTextContents();
    const p1 = titles.findIndex((t) => t.includes("Tarea P1 e2e"));
    const p2 = titles.findIndex((t) => t.includes("Tarea P2 e2e"));
    expect(p1).toBeGreaterThanOrEqual(0);
    expect(p1).toBeLessThan(p2);
  });

  test("edits a task from the edit dialog", async ({ page }) => {
    await page.goto("/");
    // Clicking a task opens the edit form directly (no separate detail dialog)
    await page
      .getByTestId("task-title")
      .filter({ hasText: "Tarea P2 e2e" })
      .first()
      .click();
    await page.getByTestId("task-title-input").fill("Tarea P2 editada");
    await page.getByTestId("task-save").click();
    await expect(page.getByText("Tarea P2 editada").first()).toBeVisible();
  });

  test("opens the pomodoro modal from the clock icon", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("pomodoro-button").first().click();
    await expect(page.getByTestId("pomodoro-dialog")).toBeVisible();
    await expect(page.getByTestId("pomodoro-time")).toHaveText(/\d{2}:\d{2}/);
    await page.keyboard.press("Escape");
  });

  test("completing a recurring task spawns the next instance", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("new-task").click();
    await page.getByTestId("task-title-input").fill("Recurrente diaria e2e");
    await page.getByTestId("task-due-input").fill(today);
    await page.getByTestId("priority-3").click();
    await page.getByTestId("recurrence-select").click();
    await page.getByRole("option", { name: /Diaria|Daily/ }).click();
    await page.getByTestId("task-save").click();

    const row = page
      .getByTestId(/task-row-/)
      .filter({ hasText: "Recurrente diaria e2e" })
      .first();
    await expect(row).toBeVisible();

    // Swipe right with the mouse to complete satisfactorily
    const box = (await row.boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 240, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();

    // The next instance shows up under Futuros after refresh
    await expect(
      page
        .getByTestId("section-upcoming")
        .locator("xpath=ancestor::div[contains(@class,'w-full')]")
        .getByText("Recurrente diaria e2e")
    ).toBeVisible({ timeout: 15_000 });
  });
});
