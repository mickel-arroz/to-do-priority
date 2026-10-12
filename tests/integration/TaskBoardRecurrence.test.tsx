import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeContent } from "@/components/home/HomeContent";
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

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
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

type Completion = { task: Task; nextTask: Task | null };

function renderHome(tasks: Task[], completedToday: Task[] = []) {
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

/** Deja correr las promesas ya resueltas y lo que encadenan. */
const flush = () => new Promise((r) => setTimeout(r, 0));

/** Una tarea diaria vencida: cada siguiente instancia sigue en Pendientes. */
function dailyTask(due: string) {
  return makeTask({ title: "Regar", due_date: due, recurrence_type: "daily" });
}

/** Lo que el servidor devuelve como siguiente instancia de `task`. */
function serverNext(task: Task, id: string, due: string): Task {
  return {
    ...task,
    id,
    due_date: due,
    recurrence_parent_id: task.recurrence_parent_id ?? task.id,
  };
}

/**
 * Las filas de Pendientes, como [id, texto visible]. Próximas y las categorías
 * vienen colapsadas, así que las únicas filas montadas son las de Pendientes.
 */
function pendingRows() {
  return screen
    .queryAllByTestId(/^task-row-/)
    .map((row) => [
      row.getAttribute("data-testid")!.replace("task-row-", ""),
      row.textContent ?? "",
    ]);
}

function pendingRow(index: number) {
  return screen.getAllByTestId(/^task-row-/)[index];
}

async function closeRow(row: HTMLElement, status: "yes" | "no" = "yes") {
  await userEvent.click(within(row).getByTestId("status-button"));
  await userEvent.click(await screen.findByTestId(`status-${status}`));
}

async function revert(taskId: string) {
  const section = screen.getByTestId("section-completed");
  if (section.getAttribute("aria-expanded") === "false") {
    await userEvent.click(section);
  }
  const row = await screen.findByTestId(`completed-row-${taskId}`);
  await userEvent.click(within(row).getByTestId("status-button"));
  await userEvent.click(await screen.findByTestId("status-pending"));
}

function completedCount() {
  return within(screen.getByTestId("section-completed")).getByText(/^\d+$/)
    .textContent;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.tasks.completed).mockResolvedValue({ tasks: [] });
  vi.mocked(api.tasks.board).mockReset();
  vi.mocked(api.tasks.complete).mockReset();
  vi.mocked(api.tasks.setStatus).mockReset();
});

describe("siguiente instancia optimista", { timeout: 20_000 }, () => {
  it("aparece al instante con la fecha que luego devuelve el servidor", async () => {
    const task = dailyTask("2026-10-01");
    const closed = deferred<Completion>();
    vi.mocked(api.tasks.complete).mockReturnValueOnce(closed.promise);
    const next = serverNext(task, "real-2", "2026-10-02");
    vi.mocked(api.tasks.board).mockResolvedValue({
      tasks: [next],
      completedToday: [{ ...task, status: "yes", completed_at: "2026-10-12T14:00:00Z" }],
    });

    renderHome([task]);
    await closeRow(screen.getByTestId(`task-row-${task.id}`));

    // Antes de que el servidor responda ya está, con identificador temporal
    const rows = pendingRows();
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).not.toBe(task.id);
    expect(rows[0][1]).toContain("2 oct");

    closed.resolve({ task, nextTask: next });
    await waitFor(() => expect(api.tasks.board).toHaveBeenCalledTimes(1));
    await flush();
    expect(pendingRows()).toEqual([["real-2", expect.stringContaining("2 oct")]]);
  });

  it("se puede cerrar antes de la respuesta: sale con el id real y nace otra", async () => {
    const task = dailyTask("2026-10-01");
    const first = deferred<Completion>();
    const second = deferred<Completion>();
    vi.mocked(api.tasks.complete)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    vi.mocked(api.tasks.board).mockReturnValue(new Promise(() => {}));
    const next = serverNext(task, "real-2", "2026-10-02");
    const nextNext = serverNext(next, "real-3", "2026-10-03");

    renderHome([task]);
    await closeRow(screen.getByTestId(`task-row-${task.id}`));
    await closeRow(pendingRow(0));

    // La tercera ya se ve, y la segunda petición espera a la primera
    expect(pendingRows()).toEqual([[expect.any(String), expect.stringContaining("3 oct")]]);
    expect(completedCount()).toBe("2");
    expect(api.tasks.complete).toHaveBeenCalledTimes(1);

    first.resolve({ task, nextTask: next });
    await waitFor(() => expect(api.tasks.complete).toHaveBeenCalledTimes(2));
    expect(api.tasks.complete).toHaveBeenLastCalledWith("real-2", "yes");

    second.resolve({ task: next, nextTask: nextNext });
    await waitFor(() => expect(api.tasks.board).toHaveBeenCalledTimes(1));
    expect(pendingRows()).toEqual([["real-3", expect.stringContaining("3 oct")]]);
  });

  it("revertir una tarea cerrada quita su siguiente instancia", async () => {
    const task = dailyTask("2026-10-01");
    const closed = deferred<Completion>();
    const reverted = deferred<{ task: Task }>();
    vi.mocked(api.tasks.complete).mockReturnValueOnce(closed.promise);
    vi.mocked(api.tasks.setStatus).mockReturnValueOnce(reverted.promise);
    vi.mocked(api.tasks.board).mockReturnValue(new Promise(() => {}));

    renderHome([task]);
    await closeRow(screen.getByTestId(`task-row-${task.id}`));
    expect(pendingRows()).toHaveLength(1);

    await revert(task.id);
    expect(pendingRows()).toEqual([[task.id, expect.stringContaining("1 oct")]]);

    closed.resolve({ task, nextTask: serverNext(task, "real-2", "2026-10-02") });
    await waitFor(() => expect(api.tasks.setStatus).toHaveBeenCalledWith(task.id, "pending"));
    await flush();
    expect(pendingRows()).toEqual([[task.id, expect.stringContaining("1 oct")]]);
  });

  it("revertir espera a lo encolado sobre su siguiente instancia", async () => {
    const task = dailyTask("2026-10-01");
    const first = deferred<Completion>();
    const second = deferred<Completion>();
    vi.mocked(api.tasks.complete)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    vi.mocked(api.tasks.setStatus).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.tasks.board).mockReturnValue(new Promise(() => {}));
    const next = serverNext(task, "real-2", "2026-10-02");

    renderHome([task]);
    await closeRow(screen.getByTestId(`task-row-${task.id}`));
    await closeRow(pendingRow(0));
    await revert(task.id);

    // Si la reversión llegara antes, el servidor borraría la instancia que
    // el cierre encolado aún tiene que cerrar
    first.resolve({ task, nextTask: next });
    await waitFor(() => expect(api.tasks.complete).toHaveBeenCalledTimes(2));
    await flush();
    expect(api.tasks.setStatus).not.toHaveBeenCalled();

    second.resolve({ task: next, nextTask: serverNext(next, "real-3", "2026-10-03") });
    await waitFor(() => expect(api.tasks.setStatus).toHaveBeenCalledWith(task.id, "pending"));
  });

  it("revertir una tarea cerrada en otra sesión quita la instancia que nació de ella", async () => {
    const closedAt = "2026-10-12T14:00:00.000Z";
    const task = {
      ...dailyTask("2026-10-01"),
      status: "yes" as const,
      completed_at: closedAt,
    };
    const next = {
      ...serverNext(task, "real-2", "2026-10-02"),
      status: "pending" as const,
      completed_at: null,
      created_at: "2026-10-12T14:00:00.250+00:00",
    };
    vi.mocked(api.tasks.setStatus).mockReturnValue(new Promise(() => {}));

    renderHome([next], [task]);
    await revert(task.id);
    expect(pendingRows()).toEqual([[task.id, expect.stringContaining("1 oct")]]);
  });

  it("un fallo en el primer eslabón revierte la cadena entera con un solo toast", async () => {
    const task = dailyTask("2026-10-01");
    const first = deferred<Completion>();
    vi.mocked(api.tasks.complete).mockReturnValueOnce(first.promise);
    vi.mocked(api.tasks.board).mockResolvedValue({ tasks: [task], completedToday: [] });

    renderHome([task]);
    await closeRow(screen.getByTestId(`task-row-${task.id}`));
    await closeRow(pendingRow(0));
    await closeRow(pendingRow(0), "no");
    expect(completedCount()).toBe("3");

    first.reject(new Error("boom"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    await flush();

    expect(api.tasks.complete).toHaveBeenCalledTimes(1);
    expect(pendingRows()).toEqual([[task.id, expect.stringContaining("1 oct")]]);
    expect(completedCount()).toBe("0");
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("un fallo en un eslabón posterior sólo revierte desde ahí", async () => {
    const task = dailyTask("2026-10-01");
    const first = deferred<Completion>();
    const second = deferred<Completion>();
    vi.mocked(api.tasks.complete)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    vi.mocked(api.tasks.board).mockReturnValue(new Promise(() => {}));
    const next = serverNext(task, "real-2", "2026-10-02");

    renderHome([task]);
    await closeRow(screen.getByTestId(`task-row-${task.id}`));
    await closeRow(pendingRow(0));
    await closeRow(pendingRow(0));
    expect(completedCount()).toBe("3");

    first.resolve({ task, nextTask: next });
    await waitFor(() => expect(api.tasks.complete).toHaveBeenCalledTimes(2));
    second.reject(new Error("boom"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    await flush();

    // El primer cierre se guardó; la segunda instancia vuelve a pendiente y
    // desaparece lo que nació de ella y lo hecho sobre eso
    expect(api.tasks.complete).toHaveBeenCalledTimes(2);
    expect(pendingRows()).toEqual([["real-2", expect.stringContaining("2 oct")]]);
    expect(completedCount()).toBe("1");
    await userEvent.click(screen.getByTestId("section-completed"));
    expect(screen.getByTestId(`completed-row-${task.id}`)).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
