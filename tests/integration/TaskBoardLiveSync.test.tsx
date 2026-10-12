import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryContent } from "@/components/categories/CategoryContent";
import { HomeContent } from "@/components/home/HomeContent";
import { PomodoroProvider } from "@/components/pomodoro/PomodoroProvider";
import { LiveSyncProvider } from "@/components/sync/LiveSync";
import { api } from "@/lib/api/client";
import { createLiveSync, type ChangeNotice } from "@/lib/live-sync";
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
const ME = "esta-pestaña";
/** Corto para no esperar 300 ms por test; la agrupación ya tiene su test unitario. */
const DEBOUNCE_MS = 30;

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

/** El módulo de sincronización real sobre un canal que el test controla. */
function fakeLiveSync() {
  const listeners = new Set<(notice: ChangeNotice) => void>();
  const sync = createLiveSync({
    clientId: ME,
    debounceMs: DEBOUNCE_MS,
    connect: (onNotice) => {
      listeners.add(onNotice);
      return () => listeners.delete(onNotice);
    },
  });
  return {
    sync,
    emit: (origin: string) => listeners.forEach((l) => l({ origin })),
  };
}

function renderHome(tasks: Task[]) {
  const live = fakeLiveSync();
  renderWithProviders(
    <LiveSyncProvider value={live.sync}>
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
    </LiveSyncProvider>
  );
  return live;
}

/** Más que la ventana de agrupación, para que cualquier aviso ya haya salido. */
const settle = () => new Promise((r) => setTimeout(r, DEBOUNCE_MS * 3));

async function close(task: Task) {
  const row = screen.getByTestId(`task-row-${task.id}`);
  await userEvent.click(within(row).getByTestId("status-button"));
  await userEvent.click(await screen.findByTestId("status-yes"));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.tasks.completed).mockResolvedValue({ tasks: [] });
  vi.mocked(api.tasks.board).mockReset();
  vi.mocked(api.tasks.complete).mockReset();
});

describe("avisos en vivo en el home", { timeout: 20_000 }, () => {
  it("un aviso de otro dispositivo trae el listado nuevo sin recargar", async () => {
    const task = makeTask({ title: "Regar", due_date: TODAY });
    vi.mocked(api.tasks.board).mockResolvedValue({
      tasks: [],
      completedToday: [{ ...task, status: "yes", completed_at: "2026-10-12T14:00:00Z" }],
    });

    const live = renderHome([task]);
    expect(screen.getByTestId(`task-row-${task.id}`)).toBeInTheDocument();

    live.emit("otro-dispositivo");
    await waitFor(() => expect(api.tasks.board).toHaveBeenCalledWith({ kind: "home" }));
    await waitFor(() =>
      expect(screen.queryByTestId(`task-row-${task.id}`)).not.toBeInTheDocument()
    );
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("su propio aviso no provoca un GET", async () => {
    const live = renderHome([makeTask({ due_date: TODAY })]);

    live.emit(ME);
    await settle();
    expect(api.tasks.board).not.toHaveBeenCalled();
  });

  it("una ráfaga de avisos produce un solo GET", async () => {
    vi.mocked(api.tasks.board).mockResolvedValue({ tasks: [], completedToday: [] });
    const live = renderHome([makeTask({ due_date: TODAY })]);

    live.emit("otro");
    live.emit("otro");
    live.emit("tercero");
    await settle();
    expect(api.tasks.board).toHaveBeenCalledTimes(1);
  });

  it("un aviso con acciones locales en curso espera a que terminen", async () => {
    const task = makeTask({ title: "Regar", due_date: TODAY });
    const closing = deferred<Completion>();
    vi.mocked(api.tasks.complete).mockReturnValueOnce(closing.promise);
    vi.mocked(api.tasks.board).mockResolvedValue({
      tasks: [],
      completedToday: [{ ...task, status: "yes", completed_at: "2026-10-12T14:00:00Z" }],
    });

    const live = renderHome([task]);
    await close(task);
    live.emit("otro");
    await settle();
    expect(api.tasks.board).not.toHaveBeenCalled();

    closing.resolve({ task, nextTask: null });
    await waitFor(() => expect(api.tasks.board).toHaveBeenCalledTimes(1));
  });

  it("en una categoría trae su listado y vuelve a pedir sus Completadas", async () => {
    vi.mocked(api.tasks.board).mockResolvedValue({ tasks: [] });
    const live = fakeLiveSync();
    renderWithProviders(
      <LiveSyncProvider value={live.sync}>
        <PomodoroProvider>
          <CategoryContent
            category={category}
            tasks={[makeTask({ category_id: "c1" })]}
            categories={[category]}
            today={TODAY}
          />
        </PomodoroProvider>
      </LiveSyncProvider>
    );
    await waitFor(() => expect(api.tasks.completed).toHaveBeenCalledTimes(1));

    live.emit("otro");
    await waitFor(() =>
      expect(api.tasks.board).toHaveBeenCalledWith({ kind: "category", categoryId: "c1" })
    );
    await waitFor(() => expect(api.tasks.completed).toHaveBeenCalledTimes(2));
  });

  it("al volver a la app se pone al día", async () => {
    vi.mocked(api.tasks.board).mockResolvedValue({ tasks: [], completedToday: [] });
    renderHome([makeTask({ due_date: TODAY })]);

    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(api.tasks.board).toHaveBeenCalledTimes(1));
  });
});
