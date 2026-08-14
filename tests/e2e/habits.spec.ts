import { expect, test } from "@playwright/test";
import { format } from "date-fns";

const today = format(new Date(), "yyyy-MM-dd");

test.describe("habits", () => {
  test("creates a habit linked to a task; completing the task marks the day", async ({
    page,
  }) => {
    // Task to link
    await page.goto("/");
    await page.getByTestId("new-task").click();
    await page.getByTestId("task-title-input").fill("Tarea hábito e2e");
    await page.getByTestId("task-due-input").fill(today);
    await page.getByTestId("priority-2").click();
    await page.getByTestId("task-save").click();
    await expect(page.getByText("Tarea hábito e2e").first()).toBeVisible();

    // Habit with a 30-day target linked to it
    await page.goto("/habits");
    await page.getByTestId("new-habit").click();
    await page.getByTestId("habit-name-input").fill("Hábito e2e");
    await page.getByTestId("goal-days").click();
    await page.getByTestId("target-days-input").fill("30");
    await page
      .locator("label")
      .filter({ hasText: "Tarea hábito e2e" })
      .locator("input[type=checkbox]")
      .check();
    await page.getByTestId("habit-save").click();
    await expect(page.getByText("Hábito e2e").first()).toBeVisible();

    // Complete the linked task with a right swipe
    await page.goto("/");
    const row = page
      .getByTestId(/task-row-/)
      .filter({ hasText: "Tarea hábito e2e" })
      .first();
    const box = (await row.boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 260, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(
      page.getByTestId(/task-row-/).filter({ hasText: "Tarea hábito e2e" })
    ).toHaveCount(0, { timeout: 10_000 });

    // The habit detail shows today as completed and streak 1
    await page.goto("/habits");
    await page.getByText("Hábito e2e").first().click();
    await expect(page.getByTestId("habit-detail")).toBeVisible();
    await expect(
      page.locator(`[data-status="completed"][title="${today}"]`)
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("habit-progress").first()).toContainText("1");
  });

  test("indefinite habits disable the punishment switch", async ({ page }) => {
    await page.goto("/habits");
    await page.getByTestId("new-habit").click();
    await page.getByTestId("goal-indefinite").click();
    await expect(page.getByTestId("punishment-switch")).toBeDisabled();
    await page.keyboard.press("Escape");
  });
});
