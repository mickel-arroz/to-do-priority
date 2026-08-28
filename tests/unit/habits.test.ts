import { describe, expect, it } from "vitest";
import {
  buildCalendarData,
  computeHabitProgress,
  isHabitDayCompleted,
  isIndefinite,
} from "@/lib/habits";
import type { Habit, HabitLog } from "@/lib/types";

function habit(partial: Partial<Habit>): Habit {
  return {
    id: "h1",
    user_id: "u1",
    name: "Test",
    description: null,
    start_date: "2026-08-01",
    target_days: 30,
    end_date: null,
    punishment_enabled: false,
    created_at: "",
    ...partial,
  };
}

function log(date: string, status: "completed" | "missed" = "completed"): HabitLog {
  return { id: date, habit_id: "h1", log_date: date, status };
}

const TODAY = "2026-08-14";

describe("isIndefinite", () => {
  it("is indefinite only without target_days and end_date", () => {
    expect(isIndefinite(habit({ target_days: null, end_date: null }))).toBe(true);
    expect(isIndefinite(habit({ target_days: 10, end_date: null }))).toBe(false);
    expect(isIndefinite(habit({ target_days: null, end_date: "2026-09-01" }))).toBe(false);
  });
});

describe("computeHabitProgress", () => {
  it("counts consecutive completed days and streaks", () => {
    const logs = ["2026-08-11", "2026-08-12", "2026-08-13"].map((d) => log(d));
    const p = computeHabitProgress(habit({ start_date: "2026-08-11" }), logs, TODAY);
    expect(p.completedDays).toBe(3);
    expect(p.currentStreak).toBe(3);
    expect(p.bestStreak).toBe(3);
    expect(p.progress).toBe(3);
  });

  it("does not count today as missed while pending", () => {
    const p = computeHabitProgress(
      habit({ start_date: "2026-08-13" }),
      [log("2026-08-13")],
      TODAY
    );
    expect(p.missedDays).toBe(0);
    expect(p.completedDays).toBe(1);
  });

  it("counts today when completed", () => {
    const p = computeHabitProgress(
      habit({ start_date: "2026-08-13" }),
      [log("2026-08-13"), log("2026-08-14")],
      TODAY
    );
    expect(p.completedDays).toBe(2);
    expect(p.currentStreak).toBe(2);
  });

  it("applies the -2 punishment clamped at 0", () => {
    // start 08-01: completed 1,2 then miss 3..13 (11 misses)
    const logs = [log("2026-08-01"), log("2026-08-02")];
    const p = computeHabitProgress(
      habit({ punishment_enabled: true, start_date: "2026-08-01" }),
      logs,
      TODAY
    );
    // 2 completed, first miss -2 -> 0, remaining misses clamp at 0
    expect(p.progress).toBe(0);
    expect(p.missedDays).toBe(11);
  });

  it("punishment subtracts 2 without going negative mid-way", () => {
    // completed 10,11,12 then missed 13 -> 3 - 2 = 1
    const logs = ["2026-08-10", "2026-08-11", "2026-08-12"].map((d) => log(d));
    const p = computeHabitProgress(
      habit({ punishment_enabled: true, start_date: "2026-08-10" }),
      logs,
      TODAY
    );
    expect(p.progress).toBe(1);
    expect(p.currentStreak).toBe(0);
  });

  it("exempts indefinite habits from punishment even when flagged", () => {
    const logs = [log("2026-08-10")];
    const p = computeHabitProgress(
      habit({
        punishment_enabled: true,
        target_days: null,
        end_date: null,
        start_date: "2026-08-10",
      }),
      logs,
      TODAY
    );
    expect(p.isIndefinite).toBe(true);
    expect(p.progress).toBe(1); // no -2 applied for the missed days
  });

  it("derives the target from end_date when target_days is null", () => {
    const p = computeHabitProgress(
      habit({ target_days: null, end_date: "2026-08-10", start_date: "2026-08-01" }),
      [],
      TODAY
    );
    expect(p.target).toBe(10);
    expect(p.isIndefinite).toBe(false);
  });

  it("does not count days after end_date", () => {
    const logs = [log("2026-08-01"), log("2026-08-02"), log("2026-08-03")];
    const p = computeHabitProgress(
      habit({ target_days: null, end_date: "2026-08-03", start_date: "2026-08-01" }),
      logs,
      TODAY
    );
    expect(p.completedDays).toBe(3);
    expect(p.missedDays).toBe(0);
    expect(p.isFinished).toBe(true);
  });

  it("caps progress at the target", () => {
    const logs = ["2026-08-01", "2026-08-02", "2026-08-03"].map((d) => log(d));
    const p = computeHabitProgress(
      habit({ target_days: 2, start_date: "2026-08-01" }),
      logs,
      TODAY
    );
    expect(p.progress).toBe(2);
    expect(p.percent).toBe(100);
  });
});

describe("buildCalendarData", () => {
  it("marks statuses per day", () => {
    const h = habit({ start_date: "2026-08-10" });
    const days = buildCalendarData(h, [log("2026-08-12")], TODAY, 2026, 7);
    const byDate = Object.fromEntries(days.map((d) => [d.date, d.status]));
    expect(byDate["2026-08-05"]).toBe("before-start");
    expect(byDate["2026-08-11"]).toBe("missed");
    expect(byDate["2026-08-12"]).toBe("completed");
    expect(byDate["2026-08-14"]).toBe("today-pending");
    expect(byDate["2026-08-20"]).toBe("future");
  });
});

describe("isHabitDayCompleted", () => {
  const DAY = "2026-08-14";
  function t(
    status: "pending" | "yes" | "no",
    due_date = DAY,
    completed_at: string | null = null
  ) {
    return { status, due_date, completed_at };
  }

  it("cuenta el día cuando todas las tareas del día son exitosas", () => {
    expect(isHabitDayCompleted([t("yes"), t("yes")], DAY)).toBe(true);
  });

  it("no cuenta el día si alguna tarea del día quedó fallada", () => {
    expect(isHabitDayCompleted([t("yes"), t("no")], DAY)).toBe(false);
  });

  it("no cuenta el día mientras quede una tarea del día pendiente", () => {
    expect(isHabitDayCompleted([t("yes"), t("pending")], DAY)).toBe(false);
  });

  it("no cuenta el día si arrastra una tarea vencida sin cerrar", () => {
    expect(isHabitDayCompleted([t("yes"), t("pending", "2026-08-12")], DAY)).toBe(
      false
    );
  });

  it("cuenta la tarea vencida que se cerró con éxito ese día", () => {
    expect(
      isHabitDayCompleted([t("yes", "2026-08-12", `${DAY}T10:00:00Z`)], DAY)
    ).toBe(true);
  });

  it("no cuenta la tarea vencida que se cerró como fallada ese día", () => {
    expect(
      isHabitDayCompleted([t("no", "2026-08-12", `${DAY}T10:00:00Z`)], DAY)
    ).toBe(false);
  });

  it("ignora las instancias futuras que crea la recurrencia", () => {
    expect(
      isHabitDayCompleted([t("yes"), t("pending", "2026-08-15")], DAY)
    ).toBe(true);
  });

  it("no acredita un día sin ninguna tarea que resolver", () => {
    expect(isHabitDayCompleted([t("yes", "2026-08-12")], DAY)).toBe(false);
    expect(isHabitDayCompleted([], DAY)).toBe(false);
  });
});
