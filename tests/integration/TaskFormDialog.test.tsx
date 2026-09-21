import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { getDictionary } from "@/lib/i18n";
import { LIMITS } from "@/lib/limits";
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
const es = getDictionary("es");
const MAX = LIMITS.subtaskTitle;

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

describe("TaskFormDialog: límite de subtareas", () => {
  const draftInput = () => screen.getByLabelText(es.tasks.subtasks);

  it("acepta una subtarea en el tope y la guarda", async () => {
    open();
    const long = "a".repeat(MAX);
    fireEvent.change(draftInput(), { target: { value: long } });

    expect(screen.getByText(`${MAX}/${MAX}`)).toBeInTheDocument();
    fireEvent.keyDown(draftInput(), { key: "Enter" });

    await userEvent.type(screen.getByTestId("task-title-input"), "Regar");
    await userEvent.click(screen.getByTestId("task-save"));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock.mock.calls[0][0].subtasks).toEqual([{ title: long }]);
  });

  it("bloquea el guardado con una subtarea que pasa el tope", async () => {
    open();
    fireEvent.change(draftInput(), { target: { value: "a".repeat(MAX + 1) } });

    expect(draftInput()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(`${MAX + 1}/${MAX}`)).toBeInTheDocument();

    await userEvent.type(screen.getByTestId("task-title-input"), "Regar");
    expect(screen.getByTestId("task-save")).toBeDisabled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("marca en rojo un chip ya añadido si la edición pasa el tope", async () => {
    open();
    fireEvent.change(draftInput(), { target: { value: "Llenar la regadera" } });
    fireEvent.keyDown(draftInput(), { key: "Enter" });

    await userEvent.click(screen.getByText("Llenar la regadera"));
    const edit = screen.getByTestId("subtask-edit-0");
    fireEvent.change(edit, { target: { value: "a".repeat(MAX + 1) } });

    expect(edit).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("task-save")).toBeDisabled();
  });
});
