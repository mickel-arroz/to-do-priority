import { screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AvailabilityDialog } from "@/components/availability/AvailabilityDialog";
import { CategoryFormDialog } from "@/components/categories/CategoryFormDialog";
import { HabitFormDialog } from "@/components/habits/HabitFormDialog";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import type { Category } from "@/lib/types";
import { renderWithProviders, routerMock } from "./helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/",
}));

vi.mock("@/lib/api/client", () => ({
  api: { availability: { get: async () => ({ blocks: [] }) } },
  ApiError: class extends Error {},
}));

beforeAll(() => {
  // El switch de disponibilidad mide su tamaño; el stub global de vitest.setup
  // no es construible y radix lo instancia con `new`.
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const category: Category = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "u1",
  name: "General",
  is_default: true,
  position: 0,
  icon: "list",
  color: null,
  created_at: "",
};

const noop = vi.fn();

/**
 * Las cuatro modales de formulario. Que la cabecera y el pie se queden fijos
 * depende de que cada una ponga sus campos en un `DialogBody` y de que sus
 * envoltorios dejen pasar la columna, y eso se escribe a mano: sin esta lista,
 * la que se lo salte regresa en silencio. Lo que se ve al scrollear lo mide el
 * e2e "only the body scrolls" de `tests/e2e/mobile.spec.ts`.
 */
const dialogs = [
  {
    name: "TaskFormDialog",
    render: () => (
      <TaskFormDialog
        open
        onOpenChange={noop}
        categories={[category]}
        task={null}
        today="2026-09-21"
      />
    ),
  },
  {
    name: "HabitFormDialog",
    render: () => (
      <HabitFormDialog
        open
        onOpenChange={noop}
        tasks={[]}
        habit={null}
        today="2026-09-21"
      />
    ),
  },
  {
    name: "CategoryFormDialog",
    render: () => (
      <CategoryFormDialog open onOpenChange={noop} category={null} />
    ),
  },
  {
    name: "AvailabilityDialog",
    render: () => <AvailabilityDialog open onOpenChange={noop} />,
  },
];

describe.each(dialogs)("$name", ({ render }) => {
  const q = (slot: string) =>
    document.querySelector<HTMLElement>(`[data-slot="dialog-${slot}"]`);

  const abrir = async () => {
    renderWithProviders(render());
    await waitFor(() => expect(q("body")).toBeInTheDocument());
  };

  it("scrollea el cuerpo y deja fuera la cabecera, el pie y el cerrar", async () => {
    await abrir();
    const body = q("body")!;

    expect(body.className).toContain("overflow-y-auto");
    expect(q("content")!.className).toContain("overflow-hidden");

    expect(body).not.toContainElement(q("header"));
    expect(body).not.toContainElement(q("footer"));
    expect(body).not.toContainElement(
      screen.getByRole("button", { name: "Close" })
    );
  });

  it("deja pasar la columna por el formulario y su fieldset", async () => {
    await abrir();

    // El cuerpo sólo crece contra el Content si todo lo que hay en medio es
    // columna (`flex-1`) o desaparece del layout (`contents`); si no, el pie
    // se sale del diálogo por abajo.
    for (
      let el = q("body")!.parentElement;
      el && el.dataset.slot !== "dialog-content";
      el = el.parentElement
    ) {
      expect(el.className).toMatch(/(^|\s)(flex-1|contents)(\s|$)/);
    }
  });
});
