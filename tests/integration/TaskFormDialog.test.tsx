import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import type { Category } from "@/lib/types";
import { renderWithProviders, routerMock } from "./helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/",
}));

const createMock = vi.fn().mockResolvedValue({ task: {} });
vi.mock("@/lib/api/client", () => ({
  api: { tasks: { create: (...args: unknown[]) => createMock(...args) } },
  ApiError: class extends Error {},
}));

const TODAY = "2026-08-14";

const categories: Category[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "u1",
    name: "General",
    is_default: true,
    position: 0,
    icon: "list",
    color: null,
    created_at: "",
  },
];

function open() {
  renderWithProviders(
    <TaskFormDialog
      open
      onOpenChange={vi.fn()}
      categories={categories}
      task={null}
      today={TODAY}
    />
  );
}

beforeEach(() => createMock.mockClear());

describe("TaskFormDialog: prioridad por defecto", () => {
  it("abre con la prioridad 4 marcada", () => {
    open();
    expect(screen.getByTestId("priority-4")).toHaveAttribute(
      "aria-checked",
      "true"
    );
    for (const other of ["priority-1", "priority-2", "priority-3"]) {
      expect(screen.getByTestId(other)).toHaveAttribute("aria-checked", "false");
    }
  });

  it("guarda con prioridad 4 si no se toca el campo", async () => {
    open();
    await userEvent.type(screen.getByTestId("task-title-input"), "Regar");
    await userEvent.click(screen.getByTestId("task-save"));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock.mock.calls[0][0]).toMatchObject({
      title: "Regar",
      priority: 4,
    });
  });
});
