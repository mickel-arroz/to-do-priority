// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  syncHabitDay,
  syncHabitDays,
  syncHabitDaysForTask,
} from "@/app/api/_lib/habit-day";
import { eqOf, fakeSupabase, type FakeOp } from "./fake-supabase";

const DAY = "2026-09-09";

function linkedTasks(tasks: Array<{ status: string; due_date: string }>) {
  return (op: FakeOp) => {
    if (op.table === "habit_tasks" && op.action === "select") {
      return tasks.map((t) => ({ tasks: t }));
    }
    return null;
  };
}

describe("syncHabitDay", () => {
  it("sólo pide a la base las tareas que vencen ese día", async () => {
    const { ctx, ops } = fakeSupabase(linkedTasks([]));
    await syncHabitDay(ctx, "h1", DAY);

    const read = ops.find((o) => o.table === "habit_tasks");
    expect(read).toBeDefined();
    expect(eqOf(read!, "habit_id")).toBe("h1");
    expect(eqOf(read!, "tasks.due_date")).toBe(DAY);
  });

  it("acredita el día cuando todas sus tareas están en 'yes'", async () => {
    const { ctx, ops } = fakeSupabase(
      linkedTasks([{ status: "yes", due_date: DAY }])
    );
    await syncHabitDay(ctx, "h1", DAY);

    const write = ops.find((o) => o.table === "habit_logs");
    expect(write?.action).toBe("upsert");
    expect(write?.payload).toMatchObject({
      habit_id: "h1",
      log_date: DAY,
      status: "completed",
    });
  });

  it("retira la acreditación cuando queda una tarea pendiente", async () => {
    const { ctx, ops } = fakeSupabase(
      linkedTasks([
        { status: "yes", due_date: DAY },
        { status: "pending", due_date: DAY },
      ])
    );
    await syncHabitDay(ctx, "h1", DAY);

    const write = ops.find((o) => o.table === "habit_logs");
    expect(write?.action).toBe("delete");
    expect(eqOf(write!, "log_date")).toBe(DAY);
  });

  it("retira la acreditación de un día que ya no tiene tareas", async () => {
    const { ctx, ops } = fakeSupabase(linkedTasks([]));
    await syncHabitDay(ctx, "h1", DAY);

    const write = ops.find((o) => o.table === "habit_logs");
    expect(write?.action).toBe("delete");
  });
});

describe("syncHabitDays", () => {
  it("recalcula cada día para cada hábito, sin repetir", async () => {
    const { ctx, ops } = fakeSupabase(linkedTasks([]));
    await syncHabitDays(ctx, ["h1", "h2", "h1"], [DAY, "2026-09-10", DAY]);

    const reads = ops
      .filter((o) => o.table === "habit_tasks")
      .map((o) => `${eqOf(o, "habit_id")}@${eqOf(o, "tasks.due_date")}`)
      .sort();
    expect(reads).toEqual([
      "h1@2026-09-09",
      "h1@2026-09-10",
      "h2@2026-09-09",
      "h2@2026-09-10",
    ]);
  });

  it("no toca la base si no hay hábitos o no hay días", async () => {
    const { ctx, ops } = fakeSupabase();
    await syncHabitDays(ctx, [], [DAY]);
    await syncHabitDays(ctx, ["h1"], []);
    expect(ops).toHaveLength(0);
  });
});

describe("syncHabitDaysForTask", () => {
  it("resuelve los hábitos de la tarea y recalcula los días indicados", async () => {
    const { ctx, ops } = fakeSupabase((op) => {
      if (op.table === "habit_tasks" && eqOf(op, "task_id") === "t1") {
        return [{ habit_id: "h1" }, { habit_id: "h2" }];
      }
      return [];
    });
    await syncHabitDaysForTask(ctx, "t1", [DAY]);

    const synced = ops
      .filter((o) => o.table === "habit_tasks" && eqOf(o, "tasks.due_date"))
      .map((o) => eqOf(o, "habit_id"))
      .sort();
    expect(synced).toEqual(["h1", "h2"]);
  });

  it("no hace nada si la tarea no está vinculada a ningún hábito", async () => {
    const { ctx, ops } = fakeSupabase(() => []);
    await syncHabitDaysForTask(ctx, "t1", [DAY]);
    expect(ops.filter((o) => o.table === "habit_logs")).toHaveLength(0);
  });
});
