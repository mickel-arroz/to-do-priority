import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { getDictionary } from "@/lib/i18n";
import { LIMITS } from "@/lib/limits";
import type { Category } from "@/lib/types";
import { makeTask, renderWithProviders, routerMock } from "./helpers";

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

describe("TaskFormDialog: el borrar de la tarea", () => {
  it("vive al final del contenido en el teléfono y en el pie en escritorio", () => {
    renderWithProviders(
      <TaskFormDialog
        open
        onOpenChange={vi.fn()}
        categories={categories}
        task={makeTask()}
        today={TODAY}
      />
    );

    // Son dos copias del mismo botón, cada una visible en su ancho: CSS no
    // mueve un nodo del cuerpo al pie.
    const body = document.querySelector('[data-slot="dialog-body"]')!;
    const footer = document.querySelector('[data-slot="dialog-footer"]')!;
    expect(body).toContainElement(screen.getByTestId("task-delete-mobile"));
    expect(footer).toContainElement(screen.getByTestId("task-delete"));
  });

  it("no aparece al crear una tarea", () => {
    open();
    expect(screen.queryByTestId("task-delete")).not.toBeInTheDocument();
    expect(screen.queryByTestId("task-delete-mobile")).not.toBeInTheDocument();
  });
});

describe("TaskFormDialog: pantalla completa en móvil", () => {
  const content = () =>
    document.querySelector<HTMLElement>('[data-slot="dialog-content"]')!;
  const body = () =>
    document.querySelector<HTMLElement>('[data-slot="dialog-body"]')!;

  it("deja la cabecera, el pie y el cerrar fuera del cuerpo que scrollea", () => {
    open();

    // Lo que scrollea es el cuerpo: los campos están dentro...
    expect(body()).toBeInTheDocument();
    expect(body()).toContainElement(screen.getByTestId("task-title-input"));

    // ...y la cabecera, el pie y el botón de cerrar, fuera, para que no se
    // vayan de la pantalla al scrollear.
    expect(body()).not.toContainElement(
      document.querySelector<HTMLElement>('[data-slot="dialog-header"]')
    );
    expect(body()).not.toContainElement(screen.getByTestId("task-save"));
    expect(body()).not.toContainElement(
      screen.getByRole("button", { name: "Close" })
    );
  });

  // jsdom no aplica CSS, así que esto no mide el scroll: es un canario sobre
  // las clases. Lo que se ve de verdad lo mide el e2e "only the body scrolls"
  // de `tests/e2e/mobile.spec.ts`, que compara cajas en un viewport móvil.
  it("deja el scroll en el cuerpo y la pantalla completa sin recortar", () => {
    open();

    expect(content().className).toContain("overflow-hidden");
    expect(content().className).not.toContain("overflow-y-auto");
    expect(body().className).toContain("overflow-y-auto");

    // Un `max-h-[90dvh]` sin prefijo ganaría al `h-dvh` de pantalla completa
    // y dejaría el pie flotando a un 10% del borde inferior.
    expect(content().className).not.toMatch(/(^|\s)max-h-\[90dvh\]/);
  });
});
