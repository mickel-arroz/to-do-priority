// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireUser } from "@/app/api/_lib/auth";
import {
  linkedHabitIds,
  syncHabitDays,
  syncHabitDaysForTask,
} from "@/app/api/_lib/habit-day";
import { POST as changeStatus } from "@/app/api/tasks/[id]/status/route";
import {
  DELETE as deleteTask,
  PATCH as patchTask,
} from "@/app/api/tasks/[id]/route";
import { PATCH as patchHabit } from "@/app/api/habits/[id]/route";
import { POST as createHabit } from "@/app/api/habits/route";
import { fakeSupabase, type Resolver } from "./fake-supabase";

vi.mock("@/app/api/_lib/auth", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/app/api/_lib/auth")>();
  return { ...mod, requireUser: vi.fn() };
});

// Mock parcial: se espían las puertas de sincronización y se deja correr
// `dueDatesOf` contra la base falsa, para comprobar qué tareas se consultan.
vi.mock("@/app/api/_lib/habit-day", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/app/api/_lib/habit-day")>();
  return {
    ...mod,
    syncHabitDays: vi.fn(),
    syncHabitDaysForTask: vi.fn(),
    linkedHabitIds: vi.fn(async () => []),
  };
});

const UUID_T1 = "11111111-1111-4111-8111-111111111111";
const UUID_T2 = "22222222-2222-4222-8222-222222222222";
const UUID_T3 = "33333333-3333-4333-8333-333333333333";

function withDb(resolve: Resolver) {
  const fake = fakeSupabase(resolve);
  vi.mocked(requireUser).mockResolvedValue(fake.ctx);
  return fake;
}

function req(body?: unknown) {
  return new Request("http://test", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function sortedDays(call: unknown[] | undefined, index: number) {
  return [...((call?.[index] as string[]) ?? [])].sort();
}

beforeEach(() => {
  vi.mocked(syncHabitDays).mockClear();
  vi.mocked(syncHabitDaysForTask).mockClear();
  vi.mocked(linkedHabitIds).mockReset().mockResolvedValue([]);
});

describe("deshacer una tarea recurrente (POST /tasks/[id]/status → pending)", () => {
  const task = {
    id: "t1",
    status: "yes",
    due_date: "2026-09-09",
    recurrence_type: "daily",
    recurrence_parent_id: null,
    completed_at: "2026-09-09T10:00:00Z",
  };

  it("recalcula también los días de las instancias que borra", async () => {
    const { ops } = withDb((op) => {
      if (op.table === "tasks" && op.action === "select" && op.single) return task;
      if (op.table === "tasks" && op.action === "select") {
        return [
          { id: "a2", due_date: "2026-09-10" },
          { id: "a3", due_date: "2026-09-11" },
        ];
      }
      if (op.table === "tasks" && op.action === "update") {
        return { ...task, status: "pending" };
      }
      return null;
    });

    const res = await changeStatus(req({ status: "pending" }), params("t1"));
    expect(res.status).toBe(200);

    const call = vi.mocked(syncHabitDaysForTask).mock.calls[0];
    expect(call?.[1]).toBe("t1");
    expect(sortedDays(call, 2)).toEqual([
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
    ]);

    const wipe = ops.find((o) => o.table === "tasks" && o.action === "delete");
    expect(wipe).toBeDefined();
    const wiped = wipe!.filters.find((f) => f.kind === "in")?.value as string[];
    expect([...wiped].sort()).toEqual(["a2", "a3"]);
  });

  it("sin instancias que borrar sólo recalcula el día de la tarea", async () => {
    withDb((op) => {
      if (op.table === "tasks" && op.action === "select" && op.single) return task;
      if (op.table === "tasks" && op.action === "select") return [];
      if (op.table === "tasks" && op.action === "update") {
        return { ...task, status: "pending" };
      }
      return null;
    });

    await changeStatus(req({ status: "pending" }), params("t1"));
    const call = vi.mocked(syncHabitDaysForTask).mock.calls[0];
    expect(sortedDays(call, 2)).toEqual(["2026-09-09"]);
  });
});

describe("cambiar el vencimiento (PATCH /tasks/[id])", () => {
  const stored = {
    id: "t1",
    due_date: "2026-09-09",
    subtasks: [],
    task_images: [],
  };

  it("recalcula el día que abandona y el que estrena", async () => {
    withDb((op) => {
      if (op.table === "tasks" && op.action === "select") return stored;
      if (op.table === "tasks" && op.action === "update") {
        return { ...stored, due_date: "2026-09-15" };
      }
      return null;
    });

    const res = await patchTask(req({ due_date: "2026-09-15" }), params("t1"));
    expect(res.status).toBe(200);

    const call = vi.mocked(syncHabitDaysForTask).mock.calls[0];
    expect(call?.[1]).toBe("t1");
    expect(sortedDays(call, 2)).toEqual(["2026-09-09", "2026-09-15"]);
  });

  it("no recalcula nada si el vencimiento no cambia", async () => {
    withDb((op) => (op.table === "tasks" ? stored : null));

    await patchTask(req({ due_date: "2026-09-09" }), params("t1"));
    await patchTask(req({ title: "Otro título" }), params("t1"));
    expect(syncHabitDaysForTask).not.toHaveBeenCalled();
  });
});

describe("borrar una tarea vinculada (DELETE /tasks/[id])", () => {
  it("captura hábitos y día antes de borrar, y los recalcula después", async () => {
    vi.mocked(linkedHabitIds).mockResolvedValue(["h1", "h2"]);
    const { ops } = withDb((op) => {
      if (op.table === "tasks" && op.action === "select") {
        return { due_date: "2026-09-09" };
      }
      if (op.table === "task_images") return [];
      return null;
    });

    const res = await deleteTask(req(), params("t1"));
    expect(res.status).toBe(200);

    expect(linkedHabitIds).toHaveBeenCalledWith(expect.anything(), "t1");
    const call = vi.mocked(syncHabitDays).mock.calls[0];
    expect([...((call?.[1] as string[]) ?? [])].sort()).toEqual(["h1", "h2"]);
    expect(sortedDays(call, 2)).toEqual(["2026-09-09"]);

    const readIdx = ops.findIndex(
      (o) => o.table === "tasks" && o.action === "select"
    );
    const deleteIdx = ops.findIndex(
      (o) => o.table === "tasks" && o.action === "delete"
    );
    expect(readIdx).toBeGreaterThanOrEqual(0);
    expect(readIdx).toBeLessThan(deleteIdx);
  });

  it("no recalcula nada si la tarea no estaba vinculada", async () => {
    withDb((op) => {
      if (op.table === "tasks" && op.action === "select") {
        return { due_date: "2026-09-09" };
      }
      if (op.table === "task_images") return [];
      return null;
    });

    await deleteTask(req(), params("t1"));
    expect(syncHabitDays).not.toHaveBeenCalled();
  });
});

describe("cambiar los vínculos de un hábito (PATCH /habits/[id])", () => {
  const dueDates: Record<string, string> = {
    [UUID_T1]: "2026-09-01",
    [UUID_T2]: "2026-09-02",
    [UUID_T3]: "2026-09-03",
  };

  it("recalcula los días de las tareas que salen y de las que entran", async () => {
    let requested: string[] = [];
    withDb((op) => {
      if (op.table === "habits") return { id: "h1" };
      if (op.table === "habit_tasks" && op.action === "select") {
        return [{ task_id: UUID_T1 }, { task_id: UUID_T2 }];
      }
      if (op.table === "tasks" && op.action === "select") {
        requested = op.filters.find((f) => f.kind === "in")?.value as string[];
        return requested.map((id) => ({ due_date: dueDates[id] }));
      }
      return null;
    });

    const res = await patchHabit(
      req({ task_ids: [UUID_T2, UUID_T3] }),
      params("h1")
    );
    expect(res.status).toBe(200);

    expect([...requested].sort()).toEqual([UUID_T1, UUID_T3]);
    const call = vi.mocked(syncHabitDays).mock.calls[0];
    expect(call?.[1]).toEqual(["h1"]);
    expect(sortedDays(call, 2)).toEqual(["2026-09-01", "2026-09-03"]);
  });

  it("no recalcula nada si los vínculos no cambian", async () => {
    withDb((op) => {
      if (op.table === "habits") return { id: "h1" };
      if (op.table === "habit_tasks" && op.action === "select") {
        return [{ task_id: UUID_T1 }, { task_id: UUID_T2 }];
      }
      return null;
    });

    await patchHabit(req({ task_ids: [UUID_T2, UUID_T1] }), params("h1"));
    expect(syncHabitDays).not.toHaveBeenCalled();
  });

  it("no toca los vínculos ni recalcula si el body no trae task_ids", async () => {
    const { ops } = withDb((op) => (op.table === "habits" ? { id: "h1" } : null));

    await patchHabit(req({ name: "Leer" }), params("h1"));
    expect(ops.filter((o) => o.table === "habit_tasks")).toHaveLength(0);
    expect(syncHabitDays).not.toHaveBeenCalled();
  });
});

describe("crear un hábito (POST /habits)", () => {
  it("acredita desde el principio los días de las tareas ya cerradas que vincula", async () => {
    withDb((op) => {
      if (op.table === "habits") return { id: "h9" };
      if (op.table === "tasks" && op.action === "select") {
        return [{ due_date: "2026-09-01" }, { due_date: "2026-09-02" }];
      }
      return null;
    });

    const res = await createHabit(
      req({ name: "Leer", task_ids: [UUID_T1, UUID_T2] })
    );
    expect(res.status).toBe(201);

    const call = vi.mocked(syncHabitDays).mock.calls[0];
    expect(call?.[1]).toEqual(["h9"]);
    expect(sortedDays(call, 2)).toEqual(["2026-09-01", "2026-09-02"]);
  });
});
