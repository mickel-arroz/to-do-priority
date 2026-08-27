import { describe, expect, it } from "vitest";
import {
  ADVICE_MAX_PENDING_TASKS,
  HABIT_DESCRIPTION_LIMIT,
  adviceWindowStart,
  buildAdvicePayload,
  isAdvicePayloadEmpty,
  linkedTaskIds,
  parseAdviceResponse,
  resolveAdviceText,
  shouldGenerateAdvice,
  toBilingual,
  wasAdviceAttemptedToday,
} from "@/lib/advice";
import type { Habit, HabitLog, Priority, Subtask, Task, TaskStatus } from "@/lib/types";

const TODAY = "2026-08-14";

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    user_id: "u1",
    category_id: "c1",
    title: `Task ${partial.id}`,
    description: null,
    link: null,
    due_date: TODAY,
    priority: 2 as Priority,
    status: "pending" as TaskStatus,
    completed_at: null,
    pomodoro_minutes: 0,
    recurrence_type: "none",
    recurrence_weekdays: null,
    recurrence_interval: 1,
    recurrence_parent_id: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

function habit(partial: Partial<Habit> & { id: string }): Habit {
  return {
    user_id: "u1",
    name: `Habit ${partial.id}`,
    description: null,
    start_date: "2026-08-01",
    target_days: 30,
    end_date: null,
    punishment_enabled: false,
    created_at: "",
    ...partial,
  };
}

function subtask(title: string, position: number, isDone = false): Subtask {
  return { id: title, task_id: "t1", title, is_done: isDone, position };
}

function log(habitId: string, date: string): HabitLog {
  return {
    id: `${habitId}-${date}`,
    habit_id: habitId,
    log_date: date,
    status: "completed",
  };
}

function build(input: Partial<Parameters<typeof buildAdvicePayload>[0]> = {}) {
  return buildAdvicePayload({ tasks: [], habits: [], logs: [], today: TODAY, ...input });
}

describe("buildAdvicePayload", () => {
  it("keeps overdue tasks whose due date falls in the last 7 days", () => {
    const payload = build({
      tasks: [
        task({ id: "1", title: "Ayer", due_date: "2026-08-13" }),
        task({ id: "2", title: "Borde", due_date: "2026-08-07" }),
        task({ id: "3", title: "Demasiado vieja", due_date: "2026-08-06" }),
      ],
    });
    expect(payload.overdueLastWeek).toEqual(["Borde", "Ayer"]);
  });

  it("keeps tasks due within the next 7 days, today included", () => {
    const payload = build({
      tasks: [
        task({ id: "1", title: "Hoy", due_date: TODAY }),
        task({ id: "2", title: "Borde", due_date: "2026-08-21" }),
        task({ id: "3", title: "Muy lejos", due_date: "2026-08-22" }),
        task({ id: "4", title: "Vencida", due_date: "2026-08-13" }),
      ],
    });
    expect(payload.dueNextWeek).toEqual(["Hoy", "Borde"]);
  });

  it("counts tasks completed and failed in the last 7 days", () => {
    const payload = build({
      tasks: [
        task({ id: "1", status: "yes", completed_at: "2026-08-13T10:00:00Z" }),
        task({ id: "2", status: "yes", completed_at: "2026-08-07T10:00:00Z" }),
        task({ id: "3", status: "yes", completed_at: "2026-08-06T10:00:00Z" }),
        task({ id: "4", status: "no", completed_at: "2026-08-12T10:00:00Z" }),
        task({ id: "5", status: "no", completed_at: "2026-08-01T10:00:00Z" }),
      ],
    });
    expect(payload.completedLastWeek).toBe(2);
    expect(payload.failedLastWeek).toBe(1);
  });

  it("caps pending tasks and keeps the highest priority ones", () => {
    const tasks = Array.from({ length: ADVICE_MAX_PENDING_TASKS + 10 }, (_, i) =>
      task({ id: String(i), title: `T${i}`, priority: (i === 45 ? 1 : 4) as Priority })
    );
    const payload = build({ tasks });
    expect(payload.pending).toHaveLength(ADVICE_MAX_PENDING_TASKS);
    expect(payload.pending[0].title).toBe("T45");
  });

  it("never sends descriptions of the home pending tasks", () => {
    const payload = build({
      tasks: [task({ id: "1", description: "un secreto muy largo" })],
    });
    expect(JSON.stringify(payload.pending)).not.toContain("secreto");
  });

  it("sends the steps of a pending task linked to a habit, in order, but never its description", () => {
    const payload = build({
      habits: [habit({ id: "h1", habit_tasks: [{ task_id: "t1" }] })],
      tasks: [
        task({
          id: "t1",
          description: "un secreto",
          subtasks: [
            subtask("Segundo", 1),
            subtask("Primero", 0, true),
          ],
        }),
      ],
    });
    expect(payload.habits[0].pendingTasks[0].subtasks).toEqual([
      { title: "Primero", done: true },
      { title: "Segundo", done: false },
    ]);
    expect(JSON.stringify(payload)).not.toContain("secreto");
  });

  it("truncates habit descriptions", () => {
    const payload = build({
      habits: [
        habit({ id: "h1", description: "x".repeat(HABIT_DESCRIPTION_LIMIT + 50) }),
      ],
    });
    expect(payload.habits[0].description).toHaveLength(HABIT_DESCRIPTION_LIMIT);
  });

  it("excludes habits that reached their target or passed their end date", () => {
    const payload = build({
      habits: [
        habit({ id: "done", target_days: 2 }),
        habit({ id: "past", target_days: null, end_date: "2026-08-10" }),
        habit({ id: "live" }),
      ],
      logs: [log("done", "2026-08-01"), log("done", "2026-08-02")],
    });
    expect(payload.habits.map((h) => h.id)).toEqual(["live"]);
  });

  it("carries habit metrics and only the pending linked tasks in full", () => {
    const payload = build({
      habits: [
        habit({
          id: "h1",
          target_days: null,
          end_date: null,
          habit_tasks: [
            { task_id: "t1" },
            { task_id: "t2" },
            { task_id: "t3" },
            { task_id: "t4" },
          ],
        }),
      ],
      logs: [log("h1", "2026-08-12"), log("h1", "2026-08-13")],
      tasks: [
        task({ id: "t1", title: "Menos urgente", priority: 4 as Priority }),
        task({
          id: "t2",
          title: "Urgente",
          priority: 1 as Priority,
          description: "lo que toca de verdad",
        }),
        task({ id: "t3", title: "Hecha", status: "yes", completed_at: "2026-01-01T00:00:00Z" }),
        task({ id: "t4", title: "Fallada", status: "no", completed_at: "2026-01-02T00:00:00Z" }),
        task({ id: "suelta", title: "Suelta" }),
      ],
    });
    const h = payload.habits[0];
    expect(h.isIndefinite).toBe(true);
    expect(h.target).toBeNull();
    expect(h.currentStreak).toBe(2);
    expect(h.completedDays).toBe(2);
    // Pendientes enteras y por prioridad; de las resueltas sólo el conteo
    expect(h.pendingTasks).toEqual([
      {
        title: "Urgente",
        subtasks: [],
        dueDate: TODAY,
        priority: 1,
        pomodoroMinutes: null,
      },
      {
        title: "Menos urgente",
        subtasks: [],
        dueDate: TODAY,
        priority: 4,
        pomodoroMinutes: null,
      },
    ]);
    expect(h.completedTasks).toBe(1);
    expect(h.failedTasks).toBe(1);
  });

  it("never sends the data of a resolved task linked to a habit", () => {
    const payload = build({
      habits: [habit({ id: "h1", habit_tasks: [{ task_id: "t1" }] })],
      tasks: [
        task({
          id: "t1",
          title: "Ya cerrada",
          description: "un secreto",
          status: "yes",
          completed_at: "2026-01-01T00:00:00Z",
        }),
      ],
    });
    expect(JSON.stringify(payload.habits[0])).not.toContain("secreto");
    expect(JSON.stringify(payload.habits[0])).not.toContain("Ya cerrada");
    expect(payload.habits[0].completedTasks).toBe(1);
  });
});

describe("pomodoro minutes", () => {
  it("carries the configured minutes and reads 0 as no timer, not as zero cost", () => {
    const payload = build({
      habits: [habit({ id: "h1", habit_tasks: [{ task_id: "t2" }] })],
      tasks: [
        task({ id: "t1", title: "Con timer", pomodoro_minutes: 45 }),
        task({ id: "t2", title: "Sin timer", pomodoro_minutes: 0 }),
      ],
    });
    const byTitle = new Map(payload.pending.map((t) => [t.title, t.pomodoroMinutes]));
    expect(byTitle.get("Con timer")).toBe(45);
    expect(byTitle.get("Sin timer")).toBeNull();
    expect(payload.habits[0].pendingTasks[0].pomodoroMinutes).toBeNull();
  });
});

describe("adviceWindowStart", () => {
  it("marks the oldest day the payload still looks at", () => {
    expect(adviceWindowStart(TODAY)).toBe("2026-08-07");
  });

  it("matches the oldest task the payload actually keeps", () => {
    const start = adviceWindowStart(TODAY);
    const payload = build({
      tasks: [
        task({ id: "1", title: "Dentro", due_date: start }),
        task({ id: "2", title: "Fuera", due_date: "2026-08-06" }),
      ],
    });
    expect(payload.overdueLastWeek).toEqual(["Dentro"]);
  });
});

describe("linkedTaskIds", () => {
  it("collects every linked task id once", () => {
    expect(
      linkedTaskIds([
        habit({ id: "h1", habit_tasks: [{ task_id: "t1" }, { task_id: "t2" }] }),
        habit({ id: "h2", habit_tasks: [{ task_id: "t2" }] }),
        habit({ id: "h3" }),
      ])
    ).toEqual(["t1", "t2"]);
  });

  it("is empty without habits", () => {
    expect(linkedTaskIds([])).toEqual([]);
  });
});

describe("toBilingual", () => {
  it("builds an advice only when both languages are stored", () => {
    expect(toBilingual("es", "en")).toEqual({ es: "es", en: "en" });
    expect(toBilingual("es", null)).toBeNull();
    expect(toBilingual(null, "en")).toBeNull();
    expect(toBilingual(undefined, undefined)).toBeNull();
  });
});

describe("isAdvicePayloadEmpty", () => {
  it("is empty without tasks and without active habits", () => {
    expect(isAdvicePayloadEmpty(build())).toBe(true);
  });

  it("is not empty with a single pending task", () => {
    expect(isAdvicePayloadEmpty(build({ tasks: [task({ id: "1" })] }))).toBe(false);
  });

  it("is not empty with a single active habit", () => {
    expect(isAdvicePayloadEmpty(build({ habits: [habit({ id: "h1" })] }))).toBe(false);
  });

  it("is empty when every habit is already finished", () => {
    const payload = build({
      habits: [habit({ id: "done", target_days: 1 })],
      logs: [log("done", "2026-08-01")],
    });
    expect(isAdvicePayloadEmpty(payload)).toBe(true);
  });
});

describe("shouldGenerateAdvice", () => {
  const payload = build({ tasks: [task({ id: "1" })] });

  it("does not generate for a user without tasks or habits", () => {
    expect(
      shouldGenerateAdvice({ payload: build(), lastAttemptDate: null, today: TODAY })
    ).toBe(false);
  });

  it("does not generate when today was already attempted", () => {
    expect(shouldGenerateAdvice({ payload, lastAttemptDate: TODAY, today: TODAY })).toBe(
      false
    );
  });

  it("generates when the last attempt was yesterday", () => {
    expect(
      shouldGenerateAdvice({ payload, lastAttemptDate: "2026-08-13", today: TODAY })
    ).toBe(true);
  });

  it("generates when nothing was ever attempted", () => {
    expect(shouldGenerateAdvice({ payload, lastAttemptDate: null, today: TODAY })).toBe(
      true
    );
  });

  it("answers today's attempt without looking at the user's data", () => {
    expect(wasAdviceAttemptedToday(TODAY, TODAY)).toBe(true);
    expect(wasAdviceAttemptedToday("2026-08-13", TODAY)).toBe(false);
    expect(wasAdviceAttemptedToday(null, TODAY)).toBe(false);
  });
});

describe("parseAdviceResponse", () => {
  const wellFormed = JSON.stringify({
    home: { es: "Consejo de inicio", en: "Home advice" },
    habits: [{ habitId: "h1", es: "Consejo de habito", en: "Habit advice" }],
  });

  it("parses a well-formed response", () => {
    const parsed = parseAdviceResponse(wellFormed, ["h1"]);
    expect(parsed.home).toEqual({ es: "Consejo de inicio", en: "Home advice" });
    expect(parsed.habits.h1).toEqual({ es: "Consejo de habito", en: "Habit advice" });
  });

  it("unwraps a markdown fence around the JSON", () => {
    const fenced = ["```json", wellFormed, "```"].join("\n");
    expect(parseAdviceResponse(fenced, ["h1"]).home.es).toBe("Consejo de inicio");
  });

  it("accepts a habit missing from the response", () => {
    const parsed = parseAdviceResponse(wellFormed, ["h1", "h2"]);
    expect(parsed.habits.h2).toBeUndefined();
    expect(parsed.habits.h1).toBeDefined();
  });

  it("drops habit ids that were never requested", () => {
    expect(parseAdviceResponse(wellFormed, ["h2"]).habits).toEqual({});
  });

  it("accepts text longer than the 200-character instruction", () => {
    const long = "a".repeat(400);
    const parsed = parseAdviceResponse(
      JSON.stringify({ home: { es: long, en: long }, habits: [] }),
      []
    );
    expect(parsed.home.es).toHaveLength(400);
  });

  it("fails cleanly on an empty or unparseable response", () => {
    expect(() => parseAdviceResponse("", [])).toThrow();
    expect(() => parseAdviceResponse("no soy json", [])).toThrow();
    expect(() => parseAdviceResponse(JSON.stringify({ habits: [] }), [])).toThrow();
    expect(() =>
      parseAdviceResponse(JSON.stringify({ home: { es: "solo" }, habits: [] }), [])
    ).toThrow();
  });
});

describe("resolveAdviceText", () => {
  const phrases = Array.from({ length: 21 }, (_, i) => `frase-${i}`);
  const advice = { es: "Consejo real", en: "Real advice" };

  it("shows the stored advice in the active locale", () => {
    expect(resolveAdviceText({ advice, locale: "es", phrases, dayOfYear: 226 })).toBe(
      "Consejo real"
    );
    expect(resolveAdviceText({ advice, locale: "en", phrases, dayOfYear: 226 })).toBe(
      "Real advice"
    );
  });

  it("falls back to a motivational phrase when there is no advice", () => {
    const text = resolveAdviceText({ advice: null, locale: "es", phrases, dayOfYear: 226 });
    expect(phrases).toContain(text);
  });

  it("keeps the same phrase all day and changes with the day", () => {
    const a = resolveAdviceText({ advice: null, locale: "es", phrases, dayOfYear: 226 });
    const b = resolveAdviceText({ advice: null, locale: "es", phrases, dayOfYear: 226 });
    const c = resolveAdviceText({ advice: null, locale: "es", phrases, dayOfYear: 227 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("never shows the home phrase on a habit the same day", () => {
    const ids = ["h1", "h2", "abc-123", "9f0", "zzz", "ade7a8b1", "0", "x"];
    for (let day = 1; day <= 366; day++) {
      const home = resolveAdviceText({ advice: null, locale: "es", phrases, dayOfYear: day });
      for (const habitId of ids) {
        expect(
          resolveAdviceText({ advice: null, locale: "es", phrases, dayOfYear: day, habitId })
        ).not.toBe(home);
      }
    }
  });

  // A diferencia de "inicio vs hábito", que es exacto por construcción, que dos
  // hábitos no coincidan depende de que sus ids caigan en saltos distintos: con
  // 21 frases hay 20 saltos, así que un par cualquiera colisiona ~5% de las
  // veces. Esta muestra fija actúa de regresión sobre el reparto del hash, no
  // de garantía. Y como el salto no depende del día, la coincidencia sería
  // permanente para ese par: de ahí el barrido por todo el año.
  it("spreads a sample of habit ids over distinct phrases, every day", () => {
    const ids = ["h1", "h2", "abc-123", "9f0", "zzz", "ade7a8b1"];
    for (let day = 1; day <= 366; day++) {
      const texts = ids.map((habitId) =>
        resolveAdviceText({ advice: null, locale: "es", phrases, dayOfYear: day, habitId })
      );
      expect(new Set(texts).size).toBe(ids.length);
    }
  });
});
