import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryContent } from "@/components/categories/CategoryContent";
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

type Completion = { task: Task; nextTask: null };

function renderHome(tasks: Task[]) {
  return renderWithProviders(
    <PomodoroProvider>
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
    </PomodoroProvider>
  );
}

/** Deja correr las promesas ya resueltas y lo que encadenan. */
const flush = () => new Promise((r) => setTimeout(r, 0));

async function close(task: Task, status: "yes" | "no" = "yes") {
  const row = screen.getByTestId(`task-row-${task.id}`);
  await userEvent.click(within(row).getByTestId("status-button"));
  await userEvent.click(await screen.findByTestId(`status-${status}`));
}

async function revert(task: Task) {
  const section = screen.getByTestId("section-completed");
  if (section.getAttribute("aria-expanded") === "false") {
    await userEvent.click(section);
  }
  const row = await screen.findByTestId(`completed-row-${task.id}`);
  await userEvent.click(within(row).getByTestId("status-button"));
  await userEvent.click(await screen.findByTestId("status-pending"));
}

function isPending(task: Task) {
  return screen.queryByTestId(`task-row-${task.id}`) !== null;
}

function completedCount() {
  return within(screen.getByTestId("section-completed")).getByText(/^\d+$/)
    .textContent;
}

/** El orden en que las peticiones de cada tarea salieron hacia el servidor. */
function sentRequests() {
  const calls = [
    ...vi.mocked(api.tasks.complete).mock.calls.map((c, i) => ({
      order: vi.mocked(api.tasks.complete).mock.invocationCallOrder[i],
      call: `complete:${c[1]}`,
    })),
    ...vi.mocked(api.tasks.setStatus).mock.calls.map((c, i) => ({
      order: vi.mocked(api.tasks.setStatus).mock.invocationCallOrder[i],
      call: `status:${c[1]}`,
    })),
  ];
  return calls.sort((a, b) => a.order - b.order).map((c) => c.call);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.tasks.completed).mockResolvedValue({ tasks: [] });
  vi.mocked(api.tasks.board).mockReset();
});

// Muchas interacciones por test: con la suite entera en paralelo pasan de 5 s
describe("cola de acciones por tarea", { timeout: 20_000 }, () => {
  it("cerrar → revertir → cerrar envía las tres peticiones en orden y acaba cerrada", async () => {
    const task = makeTask({ title: "Regar", due_date: TODAY });
    const first = deferred<Completion>();
    const second = deferred<{ task: Task }>();
    const third = deferred<Completion>();
    vi.mocked(api.tasks.complete)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(third.promise);
    vi.mocked(api.tasks.setStatus).mockReturnValueOnce(second.promise);
    vi.mocked(api.tasks.board).mockResolvedValue({
      tasks: [],
      completedToday: [{ ...task, status: "yes", completed_at: "2026-10-12T14:00:00Z" }],
    });

    renderHome([task]);
    await close(task);
    await revert(task);
    await close(task);

    // Cada paso se ve al instante, pero sólo la primera petición ha salido
    expect(isPending(task)).toBe(false);
    expect(completedCount()).toBe("1");
    expect(sentRequests()).toEqual(["complete:yes"]);

    first.resolve({ task, nextTask: null });
    await waitFor(() =>
      expect(sentRequests()).toEqual(["complete:yes", "status:pending"])
    );

    second.resolve({ task });
    await waitFor(() =>
      expect(sentRequests()).toEqual([
        "complete:yes",
        "status:pending",
        "complete:yes",
      ])
    );

    third.resolve({ task, nextTask: null });
    await waitFor(() => expect(api.tasks.board).toHaveBeenCalledTimes(1));
    await flush();
    expect(isPending(task)).toBe(false);
    expect(completedCount()).toBe("1");
  });

  it("una acción en curso sobre una tarea no retrasa las de otra", async () => {
    const a = makeTask({ title: "Primera", due_date: TODAY });
    const b = makeTask({ title: "Segunda", due_date: TODAY });
    vi.mocked(api.tasks.complete).mockReturnValue(new Promise(() => {}));

    renderHome([a, b]);
    await close(a);
    await close(b, "no");

    expect(api.tasks.complete).toHaveBeenCalledTimes(2);
    expect(api.tasks.complete).toHaveBeenLastCalledWith(b.id, "no");
  });

  it("no reconcilia con acciones encoladas y nada vuelve atrás", async () => {
    const task = makeTask({ title: "Regar", due_date: TODAY });
    const first = deferred<Completion>();
    const second = deferred<{ task: Task }>();
    vi.mocked(api.tasks.complete).mockReturnValueOnce(first.promise);
    vi.mocked(api.tasks.setStatus).mockReturnValueOnce(second.promise);
    // El servidor aún la ve cerrada: adoptarla ahora la haría volver atrás
    vi.mocked(api.tasks.board).mockResolvedValue({
      tasks: [],
      completedToday: [{ ...task, status: "yes", completed_at: "2026-10-12T14:00:00Z" }],
    });

    renderHome([task]);
    await close(task);
    await revert(task);

    first.resolve({ task, nextTask: null });
    await waitFor(() => expect(api.tasks.setStatus).toHaveBeenCalled());
    await flush();
    expect(api.tasks.board).not.toHaveBeenCalled();
    expect(isPending(task)).toBe(true);

    vi.mocked(api.tasks.board).mockResolvedValue({ tasks: [task], completedToday: [] });
    second.resolve({ task });
    await waitFor(() => expect(api.tasks.board).toHaveBeenCalledTimes(1));
    await flush();
    expect(isPending(task)).toBe(true);
  });

  it("si falla el primer eslabón revierte todo lo encolado detrás con un solo toast", async () => {
    const task = makeTask({ title: "Regar", due_date: TODAY });
    const first = deferred<Completion>();
    vi.mocked(api.tasks.complete).mockReturnValueOnce(first.promise);
    vi.mocked(api.tasks.board).mockResolvedValue({ tasks: [task], completedToday: [] });

    renderHome([task]);
    await close(task);
    await revert(task);
    await close(task, "no");

    first.reject(new Error("boom"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    await flush();

    expect(api.tasks.complete).toHaveBeenCalledTimes(1);
    expect(api.tasks.setStatus).not.toHaveBeenCalled();
    expect(isPending(task)).toBe(true);
    expect(completedCount()).toBe("0");
  });

  it("si falla un eslabón posterior conserva lo anterior y deshace desde ahí", async () => {
    const task = makeTask({ title: "Regar", due_date: TODAY });
    const first = deferred<Completion>();
    const second = deferred<{ task: Task }>();
    vi.mocked(api.tasks.complete).mockReturnValueOnce(first.promise);
    vi.mocked(api.tasks.setStatus).mockReturnValueOnce(second.promise);
    vi.mocked(api.tasks.board).mockResolvedValue({
      tasks: [],
      completedToday: [{ ...task, status: "yes", completed_at: "2026-10-12T14:00:00Z" }],
    });

    renderHome([task]);
    await close(task);
    await revert(task);
    await close(task, "no");

    first.resolve({ task, nextTask: null });
    await waitFor(() => expect(api.tasks.setStatus).toHaveBeenCalledTimes(1));
    second.reject(new Error("boom"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    await flush();

    // El cierre se guardó; la reversión y el cierre como fallada se deshacen
    expect(api.tasks.complete).toHaveBeenCalledTimes(1);
    expect(isPending(task)).toBe(false);
    expect(completedCount()).toBe("1");
    const row = screen.getByTestId(`completed-row-${task.id}`);
    expect(within(row).getByTestId("status-button")).toHaveClass("bg-success");
  });

  it("descarta un listado que llega después de encolar otra acción", async () => {
    const task = makeTask({ title: "Regar", due_date: TODAY });
    const reverted = deferred<{ task: Task }>();
    const staleBoard = deferred<{ tasks: Task[]; completedToday: Task[] }>();
    vi.mocked(api.tasks.complete).mockResolvedValueOnce({ task, nextTask: null });
    vi.mocked(api.tasks.setStatus).mockReturnValueOnce(reverted.promise);
    vi.mocked(api.tasks.board)
      .mockReturnValueOnce(staleBoard.promise)
      .mockResolvedValue({ tasks: [task], completedToday: [] });

    renderHome([task]);
    await close(task);
    await waitFor(() => expect(api.tasks.board).toHaveBeenCalledTimes(1));

    // Revertir mientras el listado viaja: la respuesta ya no vale
    await revert(task);
    staleBoard.resolve({
      tasks: [],
      completedToday: [{ ...task, status: "yes", completed_at: "2026-10-12T14:00:00Z" }],
    });
    await flush();
    expect(isPending(task)).toBe(true);

    reverted.resolve({ task });
    await waitFor(() => expect(api.tasks.board).toHaveBeenCalledTimes(2));
    await flush();
    expect(isPending(task)).toBe(true);
  });
});

describe("Completadas en una categoría", { timeout: 20_000 }, () => {
  it("no vuelve a pedirlas mientras queden acciones en cola", async () => {
    const task = makeTask({ title: "Barrer", category_id: "c1" });
    const closed = deferred<Completion>();
    const switched = deferred<{ task: Task }>();
    vi.mocked(api.tasks.complete).mockReturnValueOnce(closed.promise);
    vi.mocked(api.tasks.setStatus).mockReturnValueOnce(switched.promise);
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
    await waitFor(() => expect(api.tasks.completed).toHaveBeenCalledTimes(1));

    await close(task);
    const row = await screen.findByTestId(`completed-row-${task.id}`);
    await userEvent.click(within(row).getByTestId("status-button"));
    await userEvent.click(await screen.findByTestId("status-no"));

    closed.resolve({ task, nextTask: null });
    await waitFor(() => expect(api.tasks.setStatus).toHaveBeenCalled());
    await flush();
    expect(api.tasks.completed).toHaveBeenCalledTimes(1);

    switched.resolve({ task });
    await waitFor(() => expect(api.tasks.completed).toHaveBeenCalledTimes(2));
  });
});
