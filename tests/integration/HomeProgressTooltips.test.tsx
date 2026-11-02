import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HomeContent } from "@/components/home/HomeContent";
import { PomodoroProvider } from "@/components/pomodoro/PomodoroProvider";
import type { Locale } from "@/lib/i18n";
import type { Category, Task } from "@/lib/types";
import { makeTask, renderWithProviders, routerMock } from "./helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/",
}));

vi.mock("@/lib/api/client", () => ({
  api: { tasks: { completed: vi.fn().mockResolvedValue({ tasks: [] }) } },
  ApiError: class extends Error {},
}));

const TODAY = "2026-08-14";

const categories: Category[] = [
  {
    id: "c1",
    user_id: "u1",
    name: "General",
    is_default: true,
    position: 0,
    icon: "list",
    color: null,
    created_at: "",
  },
];

const done = (status: "yes" | "no") =>
  makeTask({ status, completed_at: `${TODAY}T10:00:00Z` });

function renderHome(
  { tasks, completedToday }: { tasks: Task[]; completedToday: Task[] },
  locale: Locale = "es"
) {
  return renderWithProviders(
    <PomodoroProvider>
      <HomeContent
        userName="Mickel Arroz"
        hour={9}
        today={TODAY}
        dayOfYear={226}
        tasks={tasks}
        completedToday={completedToday}
        categories={categories}
        advice={null}
      />
    </PomodoroProvider>,
    { locale }
  );
}

/** Dos completadas, una fallada y dos pendientes (hoy y vencida); la próxima no cuenta. */
const board = () => ({
  tasks: [
    makeTask({ due_date: TODAY }),
    makeTask({ due_date: "2026-08-10" }),
    makeTask({ due_date: "2026-08-20" }),
  ],
  completedToday: [done("yes"), done("yes"), done("no")],
});

const segment = (state: "success" | "failure" | "pending") =>
  within(screen.getByTestId("today-progress")).queryByTestId(
    `today-progress-${state}`
  );

/**
 * Cierra con Escape el tooltip abierto antes de entrar en otro segmento: en
 * jsdom los rectángulos miden cero y radix toma cualquier movimiento como un
 * tránsito hacia el tooltip abierto (su zona de gracia), sin cerrarlo ni abrir
 * el nuevo.
 */
async function hoverSegment(
  user: ReturnType<typeof userEvent.setup>,
  state: "success" | "failure" | "pending"
) {
  await user.keyboard("{Escape}");
  await user.hover(segment(state)!);
}

/** Espera a que el tooltip abierto sea éste: el anterior puede seguir cerrándose. */
const expectTooltip = (text: string) =>
  waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent(text));

describe("tooltips de la barra de progreso de la home", () => {
  it("al pasar el cursor por cada segmento muestra su conteo exacto", async () => {
    const user = userEvent.setup();
    renderHome(board());

    await hoverSegment(user, "success");
    await expectTooltip("2 completadas");

    await hoverSegment(user, "failure");
    await expectTooltip("1 fallada");

    await hoverSegment(user, "pending");
    await expectTooltip("2 pendientes");
  });

  it("al enfocar cada segmento con el teclado muestra su conteo", async () => {
    const user = userEvent.setup();
    renderHome(board());

    // Tabula hasta la barra; con tope, para fallar en vez de colgarse.
    for (let i = 0; i < 50 && document.activeElement !== segment("success"); i++)
      await user.tab();
    expect(segment("success")).toHaveFocus();
    await expectTooltip("2 completadas");

    await user.tab();
    expect(segment("failure")).toHaveFocus();
    await expectTooltip("1 fallada");

    await user.tab();
    expect(segment("pending")).toHaveFocus();
    await expectTooltip("2 pendientes");
  });

  it("los tres conteos suman el total de la barra", () => {
    renderHome(board());
    expect(screen.getByTestId("today-progress")).toHaveTextContent("3/5");
  });

  it("no pinta los segmentos sin tareas", () => {
    renderHome({ tasks: [makeTask({ due_date: TODAY })], completedToday: [] });
    expect(segment("success")).toBeNull();
    expect(segment("failure")).toBeNull();
    expect(segment("pending")).not.toBeNull();
  });

  it("usa el singular y el plural en inglés", async () => {
    const user = userEvent.setup();
    renderHome(
      {
        tasks: [makeTask({ due_date: TODAY })],
        completedToday: [done("yes"), done("no"), done("no")],
      },
      "en"
    );

    await hoverSegment(user, "success");
    await expectTooltip("1 completed");
    await hoverSegment(user, "failure");
    await expectTooltip("2 failed");
    await hoverSegment(user, "pending");
    await expectTooltip("1 pending");
  });

  it("usa el singular en español", async () => {
    const user = userEvent.setup();
    renderHome({
      tasks: [makeTask({ due_date: TODAY })],
      completedToday: [done("yes"), done("no"), done("no")],
    });

    await hoverSegment(user, "success");
    await expectTooltip("1 completada");
    await hoverSegment(user, "failure");
    await expectTooltip("2 falladas");
    await hoverSegment(user, "pending");
    await expectTooltip("1 pendiente");
  });
});
