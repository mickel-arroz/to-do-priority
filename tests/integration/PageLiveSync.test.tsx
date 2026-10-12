import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ListsContent } from "@/components/categories/ListsContent";
import { HabitDetailContent } from "@/components/habits/HabitDetailContent";
import { HabitsContent } from "@/components/habits/HabitsContent";
import { LiveSyncProvider } from "@/components/sync/LiveSync";
import type { Habit } from "@/lib/types";
import { fakeLiveSync, ME, renderWithProviders, routerMock, settle } from "./helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/lists",
}));

vi.mock("@/lib/api/client", () => ({
  api: { habits: { remove: vi.fn() } },
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

function renderLists() {
  const live = fakeLiveSync();
  renderWithProviders(
    <LiveSyncProvider value={live.sync}>
      <ListsContent categories={[]} />
    </LiveSyncProvider>
  );
  return live;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("avisos en vivo en Listas y Hábitos", { timeout: 20_000 }, () => {
  it("un aviso de otro dispositivo refresca la lista de categorías", async () => {
    const live = renderLists();

    live.emit("otro-dispositivo");
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
  });

  it("su propio aviso no refresca la página", async () => {
    const live = renderLists();

    live.emit(ME);
    await settle();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("al volver a la app se pone al día", async () => {
    renderLists();

    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
  });

  it("la lista de hábitos se refresca con un aviso ajeno", async () => {
    const live = fakeLiveSync();
    renderWithProviders(
      <LiveSyncProvider value={live.sync}>
        <HabitsContent habits={[]} logs={[]} tasks={[]} taskDays={[]} today={TODAY} />
      </LiveSyncProvider>
    );

    live.emit("otro");
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
  });

  it("el detalle de un hábito se refresca con un aviso ajeno", async () => {
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

    live.emit("otro");
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
  });
});
