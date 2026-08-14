import { expect, test } from "@playwright/test";
import { format } from "date-fns";

const today = format(new Date(), "yyyy-MM-dd");

test.describe("categories", () => {
  test("creates a list from the sidebar", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("sidebar").hover();
    await page.getByTestId("new-category").click();
    await page.getByTestId("category-name-input").fill("Lista e2e");
    await page.getByTestId("category-save").click();
    await page.getByTestId("sidebar").hover();
    await expect(page.getByTestId("sidebar").getByText("Lista e2e")).toBeVisible();
  });

  test("deleting a list with tasks can move them to General", async ({ page }) => {
    await page.goto("/");

    // Create a task inside the new list
    await page.getByTestId("new-task").click();
    await page.getByTestId("task-title-input").fill("Tarea en lista e2e");
    await page.getByTestId("task-due-input").fill(today);
    await page.getByTestId("task-category-select").click();
    await page.getByRole("option", { name: "Lista e2e" }).click();
    await page.getByTestId("task-save").click();
    await expect(page.getByText("Tarea en lista e2e").first()).toBeVisible();

    // Open the list page and delete with the move strategy
    await page.getByTestId("sidebar").hover();
    await page.getByTestId("sidebar").getByText("Lista e2e").click();
    await expect(page.getByTestId("category-page")).toBeVisible();
    await page.getByTestId("delete-category").click();
    await expect(page.getByTestId("delete-category-dialog")).toBeVisible();
    await page.getByTestId("delete-move").click();

    // Back home: the task survives under General
    await expect(page.getByTestId("home")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Tarea en lista e2e").first()).toBeVisible();
    await page.getByTestId("sidebar").hover();
    await expect(page.getByTestId("sidebar").getByText("Lista e2e")).toHaveCount(0);
  });

  test("the General list has no delete button", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("sidebar").hover();
    await page.getByTestId("sidebar").getByText("General").click();
    await expect(page.getByTestId("category-page")).toBeVisible();
    await expect(page.getByTestId("delete-category")).toHaveCount(0);
    await expect(page.getByTestId("rename-category")).toHaveCount(0);
  });
});
