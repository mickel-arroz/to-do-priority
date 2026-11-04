import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HabitDetailContent } from "@/components/habits/HabitDetailContent";
import { HomeContent } from "@/components/home/HomeContent";
import { PomodoroProvider } from "@/components/pomodoro/PomodoroProvider";
import { LiveSyncProvider } from "@/components/sync/LiveSync";
import { api } from "@/lib/api/client";
import type { Habit } from "@/lib/types";
import { fakeLiveSync, makeTask, renderWithProviders, routerMock, settle } from "./helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/",
}));

vi.mock("@/lib/api/client", () => ({
  api: {
    tasks: { completed: vi.fn(), board: vi.fn() },
    habits: { remove: vi.fn() },
  },
  ApiError: class extends Error {},
}));

const TODAY = "2026-10-12";

const habit: Habit = {
  id: "h1",
  user_id: "u1",
  name: "Leer",
  description: null,
  start_date: "2026-10-01",
  target_days: null,
  end_date: null,
  punishment_enabled: false,
  created_at: "",
  habit_tasks: [],
};

function renderHome() {
  const live = fakeLiveSync();
  renderWithProviders(
    <LiveSyncProvider value={live.sync}>
      <PomodoroProvider>
        <HomeContent
          userName="Mickel"
          hour={9}
          today={TODAY}
          dayOfYear={285}
          tasks={[makeTask({ due_date: TODAY })]}
          completedToday={[]}
          categories={[]}
          advice={{ es: "Consejo anterior", en: "Previous advice" }}
        />
      </PomodoroProvider>
    </LiveSyncProvider>
  );
  return live;
}

function renderHabitDetail() {
  const live = fakeLiveSync();
  renderWithProviders(
    <LiveSyncProvider value={live.sync}>
      <HabitDetailContent
        habit={habit}
        logs={[]}
        linkedTasks={[]}
        allTasks={[]}
        today={TODAY}
        dayOfYear={285}
        advice={null}
      />
    </LiveSyncProvider>
  );
  return live;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.tasks.completed).mockResolvedValue({ tasks: [] });
  vi.mocked(api.tasks.board).mockResolvedValue({ tasks: [], completedToday: [] });
});

describe("aviso de consejo nuevo en vivo", { timeout: 20_000 }, () => {
  it("la home refresca la ruta al recibirlo, sin pedir el tablero", async () => {
    const live = renderHome();

    live.emitNewAdvice();
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
    await settle();
    expect(api.tasks.board).not.toHaveBeenCalled();
  });

  it("un aviso de cambio en la home sólo pide el tablero, no refresca la ruta", async () => {
    const live = renderHome();

    live.emit("otro-dispositivo");
    await waitFor(() => expect(api.tasks.board).toHaveBeenCalledTimes(1));
    await settle();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("el detalle de un hábito refresca la ruta al recibirlo", async () => {
    const live = renderHabitDetail();

    live.emitNewAdvice();
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
  });
});
