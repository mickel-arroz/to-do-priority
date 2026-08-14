import { expect, test } from "@playwright/test";
import { format } from "date-fns";

const today = format(new Date(), "yyyy-MM-dd");

async function createTask(page: import("@playwright/test").Page, title: string) {
  await page.getByTestId("new-task").click();
  await page.getByTestId("task-title-input").fill(title);
  await page.getByTestId("task-due-input").fill(today);
  await page.getByTestId("priority-1").click();
  await page.getByTestId("task-save").click();
  await expect(
    page.getByTestId(/task-row-/).filter({ hasText: title }).first()
  ).toBeVisible();
}

async function swipe(
  page: import("@playwright/test").Page,
  title: string,
  direction: "right" | "left"
) {
  const row = page.getByTestId(/task-row-/).filter({ hasText: title }).first();
  const box = (await row.boundingBox())!;
  const startX = direction === "right" ? box.x + 40 : box.x + box.width - 40;
  const delta = direction === "right" ? 220 : -220;
  await page.mouse.move(startX, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(startX + delta, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
}

test.describe("swipe completion", () => {
  test("swipe right completes satisfactorily and updates the progress bar", async ({
    page,
  }) => {
    await page.goto("/");
    await createTask(page, "Swipe sí e2e");

    const progressBefore = await page.getByTestId("today-progress").textContent();
    await swipe(page, "Swipe sí e2e", "right");

    await expect(
      page.getByTestId(/task-row-/).filter({ hasText: "Swipe sí e2e" })
    ).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId("today-progress")).not.toHaveText(
      progressBefore ?? "",
      { timeout: 10_000 }
    );
  });

  test("swipe left completes unsatisfactorily", async ({ page }) => {
    await page.goto("/");
    await createTask(page, "Swipe no e2e");
    await swipe(page, "Swipe no e2e", "left");
    await expect(
      page.getByTestId(/task-row-/).filter({ hasText: "Swipe no e2e" })
    ).toHaveCount(0, { timeout: 10_000 });
  });
});
