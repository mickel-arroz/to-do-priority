import { describe, expect, it } from "vitest";
import { buildAdvicePayload } from "@/lib/advice";
import { buildAdvicePrompt } from "@/lib/ai/advice-prompt";
import type { Habit, Priority, Task, TaskStatus } from "@/lib/types";

const TODAY = "2026-08-14";
const PREVIOUS = "2026-08-11";

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

function prompt(input: Partial<Parameters<typeof buildAdvicePayload>[0]> = {}) {
  return buildAdvicePrompt(
    buildAdvicePayload({ tasks: [], habits: [], logs: [], today: TODAY, ...input })
  );
}

/** Las líneas JSON de hábitos, ya parseadas, para mirar cada una por separado. */
function habitLines(text: string): Record<string, unknown>[] {
  return text
    .split("\n")
    .filter((line) => line.startsWith('{"habitId"'))
    .map((line) => JSON.parse(line));
}

/** El JSON del resumen del usuario, ya parseado. */
function overview(text: string): Record<string, unknown> {
  const line = text.split("\n").find((l) => l.startsWith('{"today"'));
  return JSON.parse(line as string);
}

describe("buildAdvicePrompt", () => {
  it("uses the user's own sleep hours in the time budget", () => {
    const text = prompt({ sleepHours: 9 });
    expect(text).toContain("sleeps about 9 hours");
    expect(text).toContain("at most about 15 waking hours");
    expect(prompt()).toContain("sleeps about 7 hours");
  });

  it("gives the home advice every habit, active or finished, without ids", () => {
    const text = prompt({
      habits: [
        habit({ id: "h1", name: "Leer", description: "Ser lector" }),
        habit({ id: "h2", name: "Viejo", start_date: "2026-07-01", end_date: "2026-07-10" }),
      ],
    });
    const all = overview(text).allHabits as Record<string, unknown>[];
    expect(all.map((h) => [h.name, h.status])).toEqual([
      ["Leer", "active"],
      ["Viejo", "ended"],
    ]);
    expect(all[0]).toMatchObject({ description: "Ser lector", kind: "finite" });
    expect(all[0]).toHaveProperty("recentWeeks");
    expect(all[0]).not.toHaveProperty("habitId");
    // El consejo por hábito sigue cubriendo sólo los activos.
    expect(habitLines(text).map((h) => h.habitId)).toEqual(["h1"]);
  });
  it("dates today and every task with its weekday", () => {
    const text = prompt({ tasks: [task({ id: "1", due_date: "2026-08-17" })] });
    expect(text).toContain('"today":"2026-08-14"');
    expect(text).toContain('"todayWeekday":"friday"');
    expect(text).toContain('"dueDate":"2026-08-17","dueWeekday":"monday"');
  });

  it("builds without a previous advice and leaves the follow-up section out", () => {
    const text = prompt({ habits: [habit({ id: "h1" })] });
    expect(text).not.toContain("PREVIOUS ADVICE");
    expect(text).not.toContain("previousAdvice");
    expect(text).not.toContain("sincePreviousAdvice");
    expect(habitLines(text)[0]).not.toHaveProperty("previousAdvice");
  });

  it("carries the previous home advice, its date and the activity since", () => {
    const text = prompt({
      previousAdvice: {
        home: { text: "Empieza por el informe trimestral", date: PREVIOUS },
        habits: {},
      },
      tasks: [
        task({ id: "1", title: "Informe trimestral", status: "yes", completed_at: "2026-08-12T10:00:00Z" }),
        task({ id: "2", title: "Llamar al banco", status: "no", completed_at: "2026-08-13T10:00:00Z" }),
        task({ id: "3", title: "Pagar la luz", due_date: "2026-08-12" }),
      ],
    });
    expect(text).toContain("Empieza por el informe trimestral");
    expect(text).toContain(`"date":"${PREVIOUS}"`);
    expect(text).toContain('"completed":["Informe trimestral"]');
    expect(text).toContain('"failed":["Llamar al banco"]');
    expect(text).toContain('"overdue":["Pagar la luz"]');
  });

  it("puts each habit's previous advice next to that habit", () => {
    const text = prompt({
      previousAdvice: {
        home: null,
        habits: { h1: { text: "Lee diez páginas", date: PREVIOUS } },
      },
      habits: [habit({ id: "h1" }), habit({ id: "h2" })],
    });
    const [h1, h2] = habitLines(text);
    expect(h1.previousAdvice).toEqual({ text: "Lee diez páginas", date: PREVIOUS });
    expect(h1).toHaveProperty("sincePreviousAdvice");
    expect(h2).not.toHaveProperty("previousAdvice");
  });

  it("asks to judge the follow-up and to quote the previous advice only when it helps", () => {
    const text = prompt({
      previousAdvice: { home: { text: "x", date: PREVIOUS }, habits: {} },
    });
    expect(text).toContain("PREVIOUS ADVICE");
    expect(text).toMatch(/insist, adjust or change/i);
    expect(text).toMatch(/only when/i);
    expect(text).toMatch(/not a list of (banned|forbidden) phrases/i);
  });
});
