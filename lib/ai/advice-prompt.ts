import { Type } from "@google/genai";
import type { AdvicePayload } from "@/lib/advice";

/**
 * Longitud que se le pide al modelo por consejo. Es una **instrucción del
 * modelo, no un límite del sistema**: si la respuesta se pasa, se guarda y se
 * muestra igual. Por eso vive aquí, junto a la plantilla, y no en
 * `lib/limits.ts`, que está reservado a lo que sí se valida con Zod y se
 * muestra en formularios.
 */
export const ADVICE_MAX_CHARS = 400;

const bilingualText = {
  es: { type: Type.STRING },
  en: { type: Type.STRING },
};

/**
 * Pista de salida estructurada. Gemini la usa como `responseSchema`; un
 * proveedor sin salida estructurada la ignora y se apoya en el prompt.
 */
export const adviceSchema = {
  type: Type.OBJECT,
  properties: {
    home: {
      type: Type.OBJECT,
      properties: bilingualText,
      required: ["es", "en"],
    },
    habits: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { habitId: { type: Type.STRING }, ...bilingualText },
        required: ["habitId", "es", "en"],
      },
    },
  },
  required: ["home", "habits"],
};

/**
 * Plantilla única: instrucciones en inglés y salida bilingüe por texto, de
 * modo que cambiar el idioma de la app no obligue a volver a generar. Una sola
 * llamada devuelve el consejo de inicio y un consejo por hábito activo.
 */
export function buildAdvicePrompt(payload: AdvicePayload): string {
  const habits = payload.habits
    .map((h) =>
      JSON.stringify({
        habitId: h.id,
        name: h.name,
        description: h.description,
        kind: h.isIndefinite ? "open-ended" : "finite",
        progress: h.progress,
        target: h.target,
        completedDays: h.completedDays,
        missedDays: h.missedDays,
        currentStreak: h.currentStreak,
        bestStreak: h.bestStreak,
        completionRatePercent: h.completionRate,
        pendingTasks: h.pendingTasks,
        tasksDoneWell: h.completedTasks,
        tasksFailed: h.failedTasks,
      })
    )
    .join("\n");

  const overview = JSON.stringify({
    today: payload.today,
    pendingTasks: payload.pending,
    overdueInTheLast7Days: payload.overdueLastWeek,
    dueInTheNext7Days: payload.dueNextWeek,
    completedInTheLast7Days: payload.completedLastWeek,
    failedInTheLast7Days: payload.failedLastWeek,
  });

  return `You are the coach inside "To-Do Priority", a task manager built around the Eisenhower priority matrix, with habit tracking and streaks. Task priority runs from 1 (most urgent and important) to 4 (least).

You are writing today's advice for ONE user, from their real data below. Return a single JSON object following the response schema exactly.

WHAT MAKES ADVICE GOOD HERE — read this before writing anything:
Listing the user's own data back at them is NOT advice. They can already see their tasks, their counts and their streaks on screen. Your job is to tell them something they cannot see: what the numbers MEAN together, what the likely cause is, and what precise move to make next.
- BAD: "You failed 42 tasks this week. Prioritise your three overdue priority-1 tasks: A, B and C." (pure readback)
- GOOD: names the pattern, explains what it implies, then gives ONE concrete, doable next move — the smallest action that changes the situation today, and why that one.
Always end on a single, specific action. Never a menu of options. Never a generic productivity maxim.

WRITE:
1. "home": advice about the user's overall situation. Read the shape of the week: is the load too big, badly distributed, or concentrated in one priority or one deadline? A high failure count usually means over-commitment, not laziness — say so plainly and help them cut, sequence or reschedule. Weigh PRIORITY over volume. Pick at most ONE or TWO tasks by name, as the thread to pull, not as a list to recite.
2. "habits": one piece of advice per habit listed below, each carrying the exact "habitId" it belongs to. NEVER invent a habitId that is not in the input; NEVER repeat a habitId. Build each one from that habit's OWN material:
   - Its "name" and "description" say what the user is actually trying to become. Anchor the advice in that intent, not in generic habit theory.
   - "pendingTasks" is what is still open for this habit, each with its due date, priority and "subtasks": the ordered steps the task breaks down into, each flagged "done" or not. The steps are your best material — they say what the work actually involves. Point at the first step still not done inside the most important task, by name; never settle for "complete this task". If a task has no steps, work from its title and due date instead.
   - "tasksDoneWell" and "tasksFailed" are counts of already-resolved tasks for this habit. Use them ONLY to judge how the user has been coping; never list or invent resolved tasks.
   - A "finite" habit has a "target": relate progress to it and say whether the pace holds. An "open-ended" habit has NO target: never mention a goal, deadline or completion percentage for it.
   - A live "currentStreak" deserves recognition and a reason not to break it. A streak that just broke deserves a concrete way back in today, never a reproach.
   - A habit at 0 progress with days already elapsed is a starting problem, not a discipline problem: give the smallest possible first step.

STYLE — every piece of advice:
- ONE single paragraph of AT MOST ${ADVICE_MAX_CHARS} characters, warm and direct. It must be readable at a glance.
- Speak TO the user, in second person. Be concrete: their actual tasks, numbers and streaks — never generic productivity platitudes.
- Base every statement ONLY on the data below. Do not invent tasks, habits, numbers or dates that are not there.
- PLAIN TEXT ONLY: no markdown, no asterisks, no bullets, no links, no emoji.
- BILINGUAL: write every text in BOTH Spanish ("es") and English ("en"). Natural prose in each language, not a word-by-word translation.

THE POMODORO FIELD — "pomodoroMinutes" is how many minutes of focused work the user set aside for that task with the app's pomodoro timer. Read it as THEIR OWN estimate of what the task costs, and use it to reason about load against the time they have: add it up across what is due soon, contrast a heavy estimate with a near deadline, or suggest starting the one that fits the time left today. When it is null the user simply did not set a timer for that task — say nothing about it, and NEVER treat null or a missing value as "zero minutes" or as a quick task. There is no record of pomodoros actually run or completed, so never claim the user did, skipped or abandoned any session.

VOCABULARY — this product has a fixed glossary. Breaking it reads as a bug:
- In Spanish call it "hábito", ALWAYS. NEVER "meta", "objetivo", "reto" or "desafío", not even as a synonym to avoid repetition.
- In English call it "habit", ALWAYS. NEVER "goal", "challenge" or "target" for the habit itself. You may say "target" only for the numeric "target" field of a finite habit.
- A task the user let expire is "tarea vencida" / "overdue task". One they explicitly closed as not done is "tarea fallada" / "failed task". These are different things: do not mix them.
- Say "racha" / "streak" for consecutive days.

USER OVERVIEW:
${overview}

ACTIVE HABITS (${payload.habits.length} total):
${habits || "(none)"}`;
}
