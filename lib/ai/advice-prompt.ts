import { Type } from "@google/genai";
import type { AdvicePayload } from "@/lib/advice";

/**
 * Longitud que se le pide al modelo por consejo. Es una **instrucción del
 * modelo, no un límite del sistema**: si la respuesta se pasa, se guarda y se
 * muestra igual. Por eso vive aquí, junto a la plantilla, y no en
 * `lib/limits.ts`, que está reservado a lo que sí se valida con Zod y se
 * muestra en formularios.
 */
export const ADVICE_MAX_CHARS = 200;

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
        linkedTasks: h.linkedTasks,
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

WRITE:
1. "home": ONE piece of advice about the user's overall situation — what is pending, what slipped in the last 7 days, and what is coming in the next 7. Weigh PRIORITY, not just volume: point at what deserves attention first. If they failed tasks this week, let the tone match how the week actually went, without scolding.
2. "habits": ONE piece of advice per habit listed below, each carrying the exact "habitId" it belongs to. Talk about THAT habit: its progress, its streaks, its completion rate and its linked tasks. NEVER invent a habitId that is not in the input; NEVER repeat a habitId.
   - A "finite" habit has a "target": say how far they are from it and whether their pace is on track.
   - An "open-ended" habit has NO target: never mention a goal, a deadline or a percentage of completion for it.
   - A live "currentStreak" deserves recognition and a nudge not to break it. A streak that just broke deserves a way back in, never a punishment.

STYLE — every piece of advice:
- ONE single paragraph of AT MOST ${ADVICE_MAX_CHARS} characters. It must be readable at a glance.
- Speak TO the user, in second person. Be concrete: refer to their actual tasks, numbers and streaks, never generic productivity platitudes.
- Base every statement ONLY on the data below. Do not invent tasks, habits, numbers or dates that are not there.
- PLAIN TEXT ONLY: no markdown, no asterisks, no bullets, no links, no emoji.
- BILINGUAL: write every text in BOTH Spanish ("es") and English ("en"). Natural prose in each language, not a word-by-word translation.

USER OVERVIEW:
${overview}

ACTIVE HABITS (${payload.habits.length} total):
${habits || "(none)"}`;
}
