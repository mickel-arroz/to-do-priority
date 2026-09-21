import { describe, expect, it } from "vitest";
import {
  buildCalendarData,
  buildChartSeries,
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

/** Tareas vinculadas que vencen en cada uno de los días indicados. */
function dueOn(...dates: string[]) {
  return dates.map((due_date) => ({ due_date }));
}

/** Una tarea diaria: todos los días de agosto de 2026 piden algo. */
const DAILY = dueOn(
  ...Array.from({ length: 31 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`)
);

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
    const p = computeHabitProgress(habit({ start_date: "2026-08-11" }), logs, DAILY, TODAY);
    expect(p.completedDays).toBe(3);
    expect(p.currentStreak).toBe(3);
    expect(p.bestStreak).toBe(3);
    expect(p.progress).toBe(3);
  });

  it("does not count today as missed while pending", () => {
    const p = computeHabitProgress(
      habit({ start_date: "2026-08-13" }),
      [log("2026-08-13")],
      DAILY,
      TODAY
    );
    expect(p.missedDays).toBe(0);
    expect(p.completedDays).toBe(1);
  });

  it("counts today when completed", () => {
    const p = computeHabitProgress(
      habit({ start_date: "2026-08-13" }),
      [log("2026-08-13"), log("2026-08-14")],
      DAILY,
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
      DAILY,
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
      DAILY,
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
      DAILY,
      TODAY
    );
    expect(p.isIndefinite).toBe(true);
    expect(p.progress).toBe(1); // no -2 applied for the missed days
  });

  it("derives the target from end_date when target_days is null", () => {
    const p = computeHabitProgress(
      habit({ target_days: null, end_date: "2026-08-10", start_date: "2026-08-01" }),
      [],
      DAILY,
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
      DAILY,
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
      DAILY,
      TODAY
    );
    expect(p.progress).toBe(2);
    expect(p.percent).toBe(100);
  });
});

describe("buildCalendarData", () => {
  it("marks statuses per day", () => {
    const h = habit({ start_date: "2026-08-10" });
    const days = buildCalendarData(h, [log("2026-08-12")], DAILY, TODAY, 2026, 7);
    const byDate = Object.fromEntries(days.map((d) => [d.date, d.status]));
    expect(byDate["2026-08-05"]).toBe("before-start");
    expect(byDate["2026-08-11"]).toBe("missed");
    expect(byDate["2026-08-12"]).toBe("completed");
    expect(byDate["2026-08-14"]).toBe("today-pending");
    expect(byDate["2026-08-20"]).toBe("future");
  });
});

describe("días neutros: sin tarea vencida no hay nada que juzgar", () => {
  // Hábito de tarea semanal (lunes) cumplida sin fallar: 08-03 y 08-10.
  const MONDAYS = dueOn("2026-08-03", "2026-08-10", "2026-08-17");
  const mondayLogs = [log("2026-08-03"), log("2026-08-10")];

  it("un hábito semanal perfecto progresa un día por semana, con castigo", () => {
    const p = computeHabitProgress(
      habit({ punishment_enabled: true, start_date: "2026-08-01" }),
      mondayLogs,
      MONDAYS,
      TODAY
    );
    expect(p.progress).toBe(2);
    expect(p.completedDays).toBe(2);
    expect(p.missedDays).toBe(0);
    expect(p.completionRate).toBe(100);
  });

  it("y también sin castigo", () => {
    const p = computeHabitProgress(
      habit({ start_date: "2026-08-01" }),
      mondayLogs,
      MONDAYS,
      TODAY
    );
    expect(p.progress).toBe(2);
    expect(p.missedDays).toBe(0);
    expect(p.completionRate).toBe(100);
  });

  it("un día neutro no rompe la racha", () => {
    const p = computeHabitProgress(
      habit({ start_date: "2026-08-01" }),
      mondayLogs,
      MONDAYS,
      TODAY
    );
    expect(p.currentStreak).toBe(2);
    expect(p.bestStreak).toBe(2);
  });

  it("un día que sí pedía algo y no se cumplió sigue siendo fallado", () => {
    const p = computeHabitProgress(
      habit({ punishment_enabled: true, start_date: "2026-08-01" }),
      [log("2026-08-03")],
      MONDAYS,
      TODAY
    );
    // 08-03 +1, 08-10 fallado -2 → 0
    expect(p.progress).toBe(0);
    expect(p.missedDays).toBe(1);
    expect(p.currentStreak).toBe(0);
    expect(p.completionRate).toBe(50);
  });

  it("sin ninguna tarea vinculada no hay días fallados ni tasa", () => {
    const p = computeHabitProgress(habit({ start_date: "2026-08-01" }), [], [], TODAY);
    expect(p.missedDays).toBe(0);
    expect(p.completionRate).toBe(0);
  });

  it("el calendario distingue el día neutro del fallado", () => {
    const h = habit({ start_date: "2026-08-01" });
    const days = buildCalendarData(h, mondayLogs, MONDAYS, TODAY, 2026, 7);
    const byDate = Object.fromEntries(days.map((d) => [d.date, d.status]));
    expect(byDate["2026-08-03"]).toBe("completed");
    expect(byDate["2026-08-04"]).toBe("neutral");
    expect(byDate["2026-08-17"]).toBe("future");
    expect(byDate["2026-08-14"]).toBe("neutral"); // hoy sin nada que hacer
    expect(byDate["2026-07-31"]).toBe(undefined);

    const failed = buildCalendarData(h, [], dueOn("2026-08-04", TODAY), TODAY, 2026, 7);
    const byDate2 = Object.fromEntries(failed.map((d) => [d.date, d.status]));
    expect(byDate2["2026-08-04"]).toBe("missed");
    expect(byDate2["2026-08-14"]).toBe("today-pending");
  });

  it("la curva acumulada no castiga los días neutros", () => {
    const { cumulative } = buildChartSeries(
      habit({ punishment_enabled: true, start_date: "2026-08-01" }),
      mondayLogs,
      MONDAYS,
      TODAY
    );
    const at = Object.fromEntries(cumulative.map((c) => [c.date, c.progress]));
    expect(at["2026-08-03"]).toBe(1);
    expect(at["2026-08-09"]).toBe(1);
    expect(at["2026-08-10"]).toBe(2);
    expect(at["2026-08-13"]).toBe(2);
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

  it("cuenta el día cuando todas las tareas que vencían ese día son exitosas", () => {
    expect(isHabitDayCompleted([t("yes"), t("yes")], DAY)).toBe(true);
  });

  it("no cuenta el día si alguna tarea del día quedó fallada", () => {
    expect(isHabitDayCompleted([t("yes"), t("no")], DAY)).toBe(false);
  });

  it("no cuenta el día mientras quede una tarea del día pendiente", () => {
    expect(isHabitDayCompleted([t("yes"), t("pending")], DAY)).toBe(false);
  });

  it("cuenta el día aunque la tarea se cerrara mucho después de vencer", () => {
    expect(
      isHabitDayCompleted([t("yes", DAY, "2026-08-20T10:00:00Z")], DAY)
    ).toBe(true);
  });

  it("no deja que una deuda de otro día desacredite este", () => {
    expect(isHabitDayCompleted([t("yes"), t("pending", "2026-08-12")], DAY)).toBe(
      true
    );
  });

  it("no acredita el día en que se pagó una deuda, sino el que ésta vencía", () => {
    const tasks = [t("yes", "2026-08-12", `${DAY}T10:00:00Z`)];
    expect(isHabitDayCompleted(tasks, "2026-08-12")).toBe(true);
    expect(isHabitDayCompleted(tasks, DAY)).toBe(false);
  });

  it("no cuenta la tarea vencida que se cerró como fallada", () => {
    expect(isHabitDayCompleted([t("no", "2026-08-12")], "2026-08-12")).toBe(
      false
    );
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
