import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryContent } from "@/components/categories/CategoryContent";
import { HomeContent } from "@/components/home/HomeContent";
import { PendingCountsProvider } from "@/components/layout/PendingCounts";
import { PomodoroProvider } from "@/components/pomodoro/PomodoroProvider";
import { api } from "@/lib/api/client";
import type { Category, Task } from "@/lib/types";
import { deferred, makeTask, renderWithProviders, routerMock } from "./helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/",
}));

vi.mock("@/lib/api/client", () => ({
  api: {
    tasks: {
      completed: vi.fn(),
      complete: vi.fn(),
      setStatus: vi.fn(),
      board: vi.fn(),
    },
  },
  ApiError: class extends Error {},
}));

vi.mock("@/components/feedback/celebrate", () => ({ celebrate: vi.fn() }));

const TODAY = "2026-10-12";

const category: Category = {
  id: "c1",
  user_id: "u1",
  name: "Casa",
  is_default: false,
  position: 0,
  icon: "list",
  color: null,
  created_at: "",
};

function renderHome(tasks: Task[], reportCounts = vi.fn()) {
  return renderWithProviders(
    <PomodoroProvider>
      <PendingCountsProvider value={reportCounts}>
        <HomeContent
          userName="Mickel"
          hour={9}
          today={TODAY}
          dayOfYear={285}
          tasks={tasks}
          completedToday={[]}
          categories={[category]}
          advice={null}
        />
      </PendingCountsProvider>
    </PomodoroProvider>
  );
}

async function complete(title: string) {
  const row = screen
    .getAllByText(title)[0]
    .closest("[data-testid^='task-row-'], [data-testid^='task-card-']");
  await userEvent.click(within(row as HTMLElement).getByTestId("status-button"));
  await userEvent.click(await screen.findByTestId("status-yes"));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.tasks.completed).mockResolvedValue({ tasks: [] });
});

describe("TaskBoard reconcilia con GET /api/tasks/board", () => {
  it("tras completar una tarea pide el listado del home y adopta la respuesta", async () => {
    const task = makeTask({ title: "Regar las plantas", due_date: TODAY });
    const next = makeTask({ title: "Regar las plantas (mañana)", due_date: "2026-10-12" });
    vi.mocked(api.tasks.complete).mockResolvedValue({ task, nextTask: null });
    vi.mocked(api.tasks.board).mockResolvedValue({
      tasks: [next],
      completedToday: [{ ...task, status: "yes", completed_at: "2026-10-12T14:00:00Z" }],
    });

    renderHome([task]);
    await complete("Regar las plantas");

    expect(await screen.findByText("Regar las plantas (mañana)")).toBeInTheDocument();
    expect(api.tasks.board).toHaveBeenCalledWith({ kind: "home" });
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("en una categoría pide el listado de esa categoría", async () => {
    const task = makeTask({ title: "Barrer", category_id: "c1" });
    vi.mocked(api.tasks.complete).mockResolvedValue({ task, nextTask: null });
    vi.mocked(api.tasks.board).mockResolvedValue({ tasks: [] });

    renderWithProviders(
      <PomodoroProvider>
        <CategoryContent
          category={category}
          tasks={[task]}
          categories={[category]}
          today={TODAY}
        />
      </PomodoroProvider>
    );
    await complete("Barrer");

    await waitFor(() =>
      expect(api.tasks.board).toHaveBeenCalledWith({
        kind: "category",
        categoryId: "c1",
      })
    );
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("no reconcilia mientras queda una acción en curso", async () => {
    const a = makeTask({ title: "Primera", due_date: TODAY });
    const b = makeTask({ title: "Segunda", due_date: TODAY });
    const first = deferred<{ task: Task; nextTask: null }>();
    const second = deferred<{ task: Task; nextTask: null }>();
    vi.mocked(api.tasks.complete)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    vi.mocked(api.tasks.board).mockResolvedValue({ tasks: [], completedToday: [] });

    renderHome([a, b]);
    await complete("Primera");
    await complete("Segunda");

    first.resolve({ task: a, nextTask: null });
    await new Promise((r) => setTimeout(r, 0));
    expect(api.tasks.board).not.toHaveBeenCalled();

    second.resolve({ task: b, nextTask: null });
    await waitFor(() => expect(api.tasks.board).toHaveBeenCalledTimes(1));
  });
});

describe("tras reconciliar", () => {
  it("pasa a la barra lateral los pendientes de cada categoría", async () => {
    const task = makeTask({ title: "Regar las plantas", due_date: TODAY });
    vi.mocked(api.tasks.complete).mockResolvedValue({ task, nextTask: null });
    vi.mocked(api.tasks.board).mockResolvedValue({
      tasks: [makeTask({ title: "Siguiente", category_id: "c1" })],
      completedToday: [],
    });
    const reportCounts = vi.fn();

    renderHome([task], reportCounts);
    await complete("Regar las plantas");

    await waitFor(() => expect(reportCounts).toHaveBeenCalledWith({ c1: 1 }));
  });

  it("vuelve a pedir el listado si descartó la respuesta y la acción siguiente falla", async () => {
    const a = makeTask({ title: "Primera", due_date: TODAY });
    const b = makeTask({ title: "Segunda", due_date: TODAY });
    const second = deferred<{ task: Task; nextTask: null }>();
    const firstBoard = deferred<{ tasks: Task[]; completedToday: Task[] }>();
    vi.mocked(api.tasks.complete)
      .mockResolvedValueOnce({ task: a, nextTask: null })
      .mockReturnValueOnce(second.promise);
    vi.mocked(api.tasks.board)
      .mockReturnValueOnce(firstBoard.promise)
      .mockResolvedValue({ tasks: [], completedToday: [] });

    renderHome([a, b]);
    await complete("Primera");
    await waitFor(() => expect(api.tasks.board).toHaveBeenCalledTimes(1));

    // Llega con la segunda acción aún en curso: se descarta
    await complete("Segunda");
    firstBoard.resolve({ tasks: [b], completedToday: [] });
    await new Promise((r) => setTimeout(r, 0));

    second.reject(new Error("boom"));
    await waitFor(() => expect(api.tasks.board).toHaveBeenCalledTimes(2));
  });
});

describe("Completadas en el home", () => {
  function renderHomeWith(tasks: Task[], completedToday: Task[]) {
    return renderWithProviders(
      <PomodoroProvider>
        <HomeContent
          userName="Mickel"
          hour={9}
          today={TODAY}
          dayOfYear={285}
          tasks={tasks}
          completedToday={completedToday}
          categories={[category]}
          advice={null}
        />
      </PomodoroProvider>
    );
  }

  it("hay una sola sección, justo debajo de Pendientes y colapsada", () => {
    const done = makeTask({
      title: "Hecha hoy",
      status: "yes",
      completed_at: "2026-10-12T14:00:00Z",
    });
    renderHomeWith([makeTask({ title: "Pendiente", due_date: TODAY })], [done]);

    const triggers = screen.getAllByTestId(/^section-/);
    const ids = triggers.map((el) => el.dataset.testid);
    expect(ids.filter((id) => id === "section-completed")).toHaveLength(1);
    expect(ids.indexOf("section-completed")).toBe(ids.indexOf("section-pending") + 1);

    const completed = screen.getByTestId("section-completed");
    expect(completed).toHaveAttribute("aria-expanded", "false");
    expect(within(completed).getByText("1")).toBeInTheDocument();
    // Ni al pie de Pendientes ni dentro de la sección cerrada
    expect(screen.queryByText("Hecha hoy")).not.toBeInTheDocument();
  });

  it("al desplegarla lista lo del día del usuario que trae el tablero, no el historial reciente", async () => {
    const done = makeTask({
      title: "Hecha hoy",
      status: "yes",
      completed_at: "2026-10-12T14:00:00Z",
    });
    // El historial reciente de cualquier día no entra en el home
    vi.mocked(api.tasks.completed).mockResolvedValue({
      tasks: [
        {
          ...makeTask({ title: "Hecha ayer", status: "yes", completed_at: "2026-10-12T01:00:00Z" }),
          categories: null,
        },
      ],
    });
    renderHomeWith([], [done]);

    await userEvent.click(screen.getByTestId("section-completed"));

    expect(await screen.findByText("Hecha hoy")).toBeInTheDocument();
    expect(screen.queryByText("Hecha ayer")).not.toBeInTheDocument();
    expect(api.tasks.completed).not.toHaveBeenCalled();
  });

  it("una tarea cerrada aparece en Completadas al instante y no en Pendientes", async () => {
    const task = makeTask({ title: "Regar las plantas", due_date: TODAY });
    vi.mocked(api.tasks.complete).mockReturnValue(new Promise(() => {}));
    renderHomeWith([task], []);

    await complete("Regar las plantas");

    const completed = screen.getByTestId("section-completed");
    expect(within(completed).getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("Regar las plantas")).not.toBeInTheDocument();

    await userEvent.click(completed);
    expect(await screen.findAllByText("Regar las plantas")).toHaveLength(1);
    expect(screen.getByTestId(`completed-row-${task.id}`)).toBeInTheDocument();
  });
});

describe("Completadas en una categoría", () => {
  it("conserva el historial reciente de cualquier día", async () => {
    vi.mocked(api.tasks.completed).mockResolvedValue({
      tasks: [
        {
          ...makeTask({ title: "Hecha ayer", status: "yes", completed_at: "2026-10-11T14:00:00Z" }),
          categories: null,
        },
      ],
    });
    renderWithProviders(
      <PomodoroProvider>
        <CategoryContent
          category={category}
          tasks={[]}
          categories={[category]}
          today={TODAY}
        />
      </PomodoroProvider>
    );

    expect(await screen.findByText("Hecha ayer")).toBeInTheDocument();
    expect(api.tasks.completed).toHaveBeenCalledWith("c1");
  });
});
