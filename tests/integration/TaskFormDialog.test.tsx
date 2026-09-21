import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
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

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

const createMock = vi.fn().mockResolvedValue({ task: {} });
let subtaskSeq = 0;
const addSubtaskMock = vi.fn(async (_taskId: string, title: string) => ({
  subtask: {
    id: `st-${++subtaskSeq}`,
    title,
    is_done: false,
    position: subtaskSeq,
  },
}));
vi.mock("@/lib/api/client", () => ({
  api: {
    tasks: {
      create: (...args: unknown[]) => createMock(...args),
      addSubtask: (id: string, title: string) => addSubtaskMock(id, title),
    },
  },
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

beforeEach(() => {
  createMock.mockClear();
  addSubtaskMock.mockClear();
  vi.mocked(toast.info).mockClear();
});

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

describe("TaskFormDialog: pegar varias subtareas", () => {
  const draftInput = () => screen.getByLabelText<HTMLInputElement>(es.tasks.subtasks);

  /** Un pegado de verdad: devuelve false si el componente lo interceptó. */
  function paste(text: string, { at }: { at?: number } = {}) {
    const el = draftInput();
    const caret = at ?? el.value.length;
    el.setSelectionRange(caret, caret);
    return fireEvent.paste(el, {
      clipboardData: { getData: () => text },
    });
  }

  const subtaskTitles = () =>
    screen
      .getAllByTitle(es.common.edit)
      .map((el) => el.textContent);

  it("crea una subtarea por línea no vacía", () => {
    open();
    paste("Comprar pan\n\nLlamar al banco\n   \nRegar plantas");

    expect(subtaskTitles()).toEqual([
      "Comprar pan",
      "Llamar al banco",
      "Regar plantas",
    ]);
  });

  it("crea una subtarea por elemento de una lista con viñetas, sin el marcador", () => {
    open();
    paste("- Comprar pan\n* Llamar al banco\n• Regar plantas");

    expect(subtaskTitles()).toEqual([
      "Comprar pan",
      "Llamar al banco",
      "Regar plantas",
    ]);
  });

  it("crea una subtarea por elemento de una lista numerada, sin el número", () => {
    open();
    paste("1. Comprar pan\n2) Llamar al banco\n3- Regar plantas");

    expect(subtaskTitles()).toEqual([
      "Comprar pan",
      "Llamar al banco",
      "Regar plantas",
    ]);
  });

  it("deja pasar el pegado de una sola línea sin tocarlo", () => {
    open();
    const notIntercepted = paste("- Comprar pan");

    expect(notIntercepted).toBe(true);
    expect(screen.queryAllByTitle(es.common.edit)).toHaveLength(0);
  });

  it("fusiona lo que ya había escrito con la primera línea pegada", () => {
    open();
    fireEvent.change(draftInput(), { target: { value: "Comprar " } });
    paste("pan\nleche");

    expect(subtaskTitles()).toEqual(["Comprar pan", "leche"]);
    expect(draftInput().value).toBe("");
  });

  it("añade lo pegado al final de las subtareas que ya había", () => {
    open();
    fireEvent.change(draftInput(), { target: { value: "Llenar la regadera" } });
    fireEvent.keyDown(draftInput(), { key: "Enter" });
    paste("Comprar pan\nLlamar al banco");

    expect(subtaskTitles()).toEqual([
      "Llenar la regadera",
      "Comprar pan",
      "Llamar al banco",
    ]);
  });

  it("trunca al tope la línea que se pasa de largo", async () => {
    open();
    paste(`${"a".repeat(MAX + 40)}\nCorta`);

    expect(subtaskTitles()).toEqual(["a".repeat(MAX), "Corta"]);
    // Truncar, y no dejarla entrar entera, es lo que mantiene el formulario
    // guardable: una subtarea pasada de largo bloquea el guardar.
    await userEvent.type(screen.getByTestId("task-title-input"), "Recados");
    expect(screen.getByTestId("task-save")).not.toBeDisabled();
  });

  it("respeta el tope de subtareas y avisa de lo que descartó", () => {
    open();
    const lines = Array.from(
      { length: LIMITS.subtasksPerTask + 5 },
      (_, i) => `Paso ${i + 1}`
    );
    paste(lines.join("\n"));

    expect(subtaskTitles()).toHaveLength(LIMITS.subtasksPerTask);
    expect(subtaskTitles().at(-1)).toBe(`Paso ${LIMITS.subtasksPerTask}`);
    expect(toast.info).toHaveBeenCalledWith(es.tasks.subtaskLimitReached);
  });

  it("guarda la tarea con todas las subtareas pegadas", async () => {
    open();
    paste("Comprar pan\nLlamar al banco");

    await userEvent.type(screen.getByTestId("task-title-input"), "Recados");
    await userEvent.click(screen.getByTestId("task-save"));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock.mock.calls[0][0].subtasks).toEqual([
      { title: "Comprar pan" },
      { title: "Llamar al banco" },
    ]);
  });

  it("en edición crea las subtareas en orden, una llamada por elemento", async () => {
    renderWithProviders(
      <TaskFormDialog
        open
        onOpenChange={vi.fn()}
        categories={categories}
        task={makeTask({ subtasks: [] })}
        today={TODAY}
      />
    );
    paste("- Comprar pan\n- Llamar al banco");

    await waitFor(() => expect(addSubtaskMock).toHaveBeenCalledTimes(2));
    expect(addSubtaskMock.mock.calls.map((c) => c[1])).toEqual([
      "Comprar pan",
      "Llamar al banco",
    ]);
    expect(subtaskTitles()).toEqual(["Comprar pan", "Llamar al banco"]);
  });
});

describe("TaskFormDialog: pegar sin hueco para todas", () => {
  const draftInput = () =>
    screen.getByLabelText<HTMLInputElement>(es.tasks.subtasks);

  function paste(text: string) {
    const el = draftInput();
    el.setSelectionRange(el.value.length, el.value.length);
    return fireEvent.paste(el, { clipboardData: { getData: () => text } });
  }

  const subtaskTitles = () =>
    screen.getAllByTitle(es.common.edit).map((el) => el.textContent);

  const manySubtasks = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `st-existente-${i}`,
      task_id: "t1",
      title: `Paso viejo ${i + 1}`,
      is_done: false,
      position: i,
    }));

  function openEditing(subtasks: ReturnType<typeof manySubtasks>) {
    renderWithProviders(
      <TaskFormDialog
        open
        onOpenChange={vi.fn()}
        categories={categories}
        task={makeTask({ subtasks })}
        today={TODAY}
      />
    );
  }

  it("no toca lo que hubiera escrito si ya no cabe ninguna", () => {
    openEditing(manySubtasks(LIMITS.subtasksPerTask));
    fireEvent.change(draftInput(), { target: { value: "A medio escribir" } });
    paste("Comprar pan\nLlamar al banco");

    // El pegado no cupo, pero el borrador es del usuario: no se tira.
    expect(draftInput().value).toBe("A medio escribir");
    expect(addSubtaskMock).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith(es.tasks.subtaskLimitReached);
  });

  it("en edición solo sube las que caben en el hueco que queda", async () => {
    openEditing(manySubtasks(LIMITS.subtasksPerTask - 1));
    paste("Comprar pan\nLlamar al banco\nRegar plantas");

    await waitFor(() => expect(addSubtaskMock).toHaveBeenCalledTimes(1));
    expect(addSubtaskMock.mock.calls[0][1]).toBe("Comprar pan");
    expect(subtaskTitles()).toHaveLength(LIMITS.subtasksPerTask);
    expect(toast.info).toHaveBeenCalledWith(es.tasks.subtaskLimitReached);
  });

  it("deja el pegado de una sola línea larga como siempre, sin recortarlo", () => {
    open();
    // Es el check «una sola línea mantiene el comportamiento actual»: el campo
    // se pone en rojo y el usuario decide, igual que si la hubiera tecleado.
    const notIntercepted = paste("a".repeat(MAX + 40));

    expect(notIntercepted).toBe(true);
    expect(screen.queryAllByTitle(es.common.edit)).toHaveLength(0);
  });
});
