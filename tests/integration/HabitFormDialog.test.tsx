import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HabitFormDialog } from "@/components/habits/HabitFormDialog";
import { api } from "@/lib/api/client";
import type { Habit, Task } from "@/lib/types";
import { makeTask, renderWithProviders, routerMock } from "./helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/habits",
}));

vi.mock("@/lib/api/client", () => ({
  api: {
    tasks: { list: vi.fn() },
    habits: { update: vi.fn(), create: vi.fn() },
  },
  ApiError: class extends Error {},
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const TODAY = "2026-10-12";

/** Un hábito con estas tareas vinculadas, cerradas o pendientes. */
function makeHabit(taskIds: string[]): Habit {
  return {
    id: "h1",
    user_id: "u1",
    name: "Leer",
    description: null,
    start_date: "2026-08-01",
    target_days: 30,
    end_date: null,
    punishment_enabled: false,
    created_at: "",
    habit_tasks: taskIds.map((task_id) => ({ task_id })),
  };
}

function renderForm(habit: Habit, pending: Task[]) {
  return renderWithProviders(
    <HabitFormDialog
      open
      onOpenChange={() => {}}
      tasks={pending}
      habit={habit}
      today={TODAY}
    />
  );
}

async function renameAndSave(name: string) {
  const input = screen.getByTestId("habit-name-input");
  await userEvent.clear(input);
  await userEvent.type(input, name);
  await userEvent.click(screen.getByTestId("habit-save"));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.habits.update).mockResolvedValue({} as never);
});

describe("editar un hábito con historial", () => {
  it("manda sólo las tareas pendientes vinculadas, no las instancias ya cerradas", async () => {
    const pending = makeTask({ title: "Leer 20 páginas" });
    vi.mocked(api.tasks.list).mockResolvedValue({ tasks: [pending], hasMore: false });
    const history = Array.from({ length: 60 }, (_, i) => `cerrada-${i}`);
    renderForm(makeHabit([pending.id, ...history]), [pending]);

    expect(screen.getByTestId(`link-task-${pending.id}`)).toBeChecked();
    await renameAndSave("Leer más");

    await waitFor(() => expect(api.habits.update).toHaveBeenCalled());
    expect(vi.mocked(api.habits.update).mock.calls[0][1].task_ids).toEqual([
      pending.id,
    ]);
  });

  it("deja guardar aunque no le quede ninguna pendiente si tiene historial", async () => {
    vi.mocked(api.tasks.list).mockResolvedValue({ tasks: [], hasMore: false });
    renderForm(makeHabit(["cerrada-1", "cerrada-2"]), []);

    await renameAndSave("Leer más");

    await waitFor(() => expect(api.habits.update).toHaveBeenCalled());
    expect(vi.mocked(api.habits.update).mock.calls[0][1].task_ids).toEqual([]);
  });
});
