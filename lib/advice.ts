import { addDays } from "date-fns";
import { z } from "zod";
import { computeHabitProgress } from "@/lib/habits";
import type { Locale } from "@/lib/i18n";
import { formatDate, parseDate } from "@/lib/recurrence";
import { sortByPriority } from "@/lib/tasks";
import type { Habit, HabitLog, Priority, Task, TaskStatus } from "@/lib/types";

/**
 * Núcleo puro de los consejos: construye la carga del prompt, parsea la
 * respuesta del proveedor, decide si toca la generación diaria y resuelve el
 * texto que se pinta. Nada aquí hace I/O; el proveedor, el disparo y la
 * persistencia viven fuera y se apoyan en estas funciones.
 */

export type Bilingual = { es: string; en: string };

/** Tope de tareas pendientes que viajan al prompt: acota el coste por usuario. */
export const ADVICE_MAX_PENDING_TASKS = 40;
/** Las descripciones de hábito se truncan; las de tarea no se envían nunca. */
export const HABIT_DESCRIPTION_LIMIT = 500;
/** Ventana, en días, hacia atrás (vencidas, completadas) y hacia delante (próximas). */
export const ADVICE_WINDOW_DAYS = 7;

export type AdviceTaskSummary = {
  title: string;
  priority: Priority;
  dueDate: string;
};

export type AdviceHabitSummary = {
  id: string;
  name: string;
  description: string | null;
  isIndefinite: boolean;
  progress: number;
  target: number | null;
  completedDays: number;
  missedDays: number;
  currentStreak: number;
  bestStreak: number;
  completionRate: number;
  linkedTasks: { title: string; status: TaskStatus }[];
};

export type AdvicePayload = {
  today: string;
  /** Pendientes por prioridad, recortadas a ADVICE_MAX_PENDING_TASKS. */
  pending: AdviceTaskSummary[];
  /** Títulos de las vencidas cuyo vencimiento cae en los últimos 7 días. */
  overdueLastWeek: string[];
  /** Títulos de las que vencen entre hoy y dentro de 7 días. */
  dueNextWeek: string[];
  completedLastWeek: number;
  failedLastWeek: number;
  /** Sólo hábitos activos: los terminados no consumen generaciones. */
  habits: AdviceHabitSummary[];
};

function shift(today: string, days: number): string {
  return formatDate(addDays(parseDate(today), days));
}

/**
 * Primer día de la ventana hacia atrás. Lo expone el núcleo para que la query
 * que alimenta la carga traiga exactamente lo que la carga mira, ni una fila
 * más: si la ventana cambia, cambian las dos a la vez.
 */
export function adviceWindowStart(today: string): string {
  return shift(today, -ADVICE_WINDOW_DAYS);
}

/** Ids de las tareas vinculadas a algún hábito, sin repetir. */
export function linkedTaskIds(habits: Habit[]): string[] {
  return [
    ...new Set(
      habits.flatMap((h) => (h.habit_tasks ?? []).map((link) => link.task_id))
    ),
  ];
}

/** Un hábito terminado alcanzó su objetivo o dejó atrás su fecha de fin. */
function isFinishedHabit(habit: Habit, logs: HabitLog[], today: string): boolean {
  if (habit.end_date !== null && habit.end_date < today) return true;
  return computeHabitProgress(habit, logs, today).isFinished;
}

export function buildAdvicePayload(input: {
  /** Tareas del usuario en cualquier estado; las descripciones se descartan. */
  tasks: Task[];
  habits: Habit[];
  logs: HabitLog[];
  today: string;
}): AdvicePayload {
  const { tasks, habits, logs, today } = input;
  const weekAgo = adviceWindowStart(today);
  const weekAhead = shift(today, ADVICE_WINDOW_DAYS);

  const open = tasks.filter((t) => t.status === "pending");
  const byDueDate = (a: Task, b: Task) => a.due_date.localeCompare(b.due_date);

  const resolvedInWindow = (status: TaskStatus) =>
    tasks.filter(
      (t) =>
        t.status === status &&
        t.completed_at !== null &&
        t.completed_at.slice(0, 10) >= weekAgo
    ).length;

  const logsByHabit = new Map<string, HabitLog[]>();
  for (const log of logs) {
    const list = logsByHabit.get(log.habit_id) ?? [];
    list.push(log);
    logsByHabit.set(log.habit_id, list);
  }

  const tasksById = new Map(tasks.map((t) => [t.id, t]));

  return {
    today,
    pending: sortByPriority(open)
      .slice(0, ADVICE_MAX_PENDING_TASKS)
      .map((t) => ({ title: t.title, priority: t.priority, dueDate: t.due_date })),
    overdueLastWeek: open
      .filter((t) => t.due_date < today && t.due_date >= weekAgo)
      .sort(byDueDate)
      .map((t) => t.title),
    dueNextWeek: open
      .filter((t) => t.due_date >= today && t.due_date <= weekAhead)
      .sort(byDueDate)
      .map((t) => t.title),
    completedLastWeek: resolvedInWindow("yes"),
    failedLastWeek: resolvedInWindow("no"),
    habits: habits
      .filter((h) => !isFinishedHabit(h, logsByHabit.get(h.id) ?? [], today))
      .map((h) => {
        const progress = computeHabitProgress(h, logsByHabit.get(h.id) ?? [], today);
        return {
          id: h.id,
          name: h.name,
          description: h.description?.slice(0, HABIT_DESCRIPTION_LIMIT) ?? null,
          isIndefinite: progress.isIndefinite,
          progress: progress.progress,
          target: progress.target,
          completedDays: progress.completedDays,
          missedDays: progress.missedDays,
          currentStreak: progress.currentStreak,
          bestStreak: progress.bestStreak,
          completionRate: progress.completionRate,
          linkedTasks: linkedTaskIds([h])
            .map((id) => tasksById.get(id))
            .filter((t): t is Task => t !== undefined)
            .map((t) => ({ title: t.title, status: t.status })),
        };
      }),
  };
}

/** Sin nada que contar no se reclama el día ni se llama a la IA. */
export function isAdvicePayloadEmpty(payload: AdvicePayload): boolean {
  return (
    payload.pending.length === 0 &&
    payload.habits.length === 0 &&
    payload.completedLastWeek === 0 &&
    payload.failedLastWeek === 0
  );
}

/**
 * Reclamar el día y marcar el intento son el mismo acto, así que un fallo
 * tampoco se reintenta en bucle: basta con que ya se haya intentado hoy.
 *
 * Se comprueba aparte de `shouldGenerateAdvice` porque es lo único que puede
 * decidirse sin mirar los datos del usuario, y en la inmensa mayoría de las
 * navegaciones basta con esto para no leer nada más.
 */
export function wasAdviceAttemptedToday(
  lastAttemptDate: string | null,
  today: string
): boolean {
  return lastAttemptDate === today;
}

export function shouldGenerateAdvice(input: {
  payload: AdvicePayload;
  lastAttemptDate: string | null;
  today: string;
}): boolean {
  if (wasAdviceAttemptedToday(input.lastAttemptDate, input.today)) return false;
  return !isAdvicePayloadEmpty(input.payload);
}

const bilingualSchema = z.object({
  es: z.string().trim().min(1),
  en: z.string().trim().min(1),
});

const adviceResponseSchema = z.object({
  home: bilingualSchema,
  habits: z
    .array(bilingualSchema.extend({ habitId: z.string() }))
    .default([]),
});

export type ParsedAdvice = {
  home: Bilingual;
  /** Sólo los hábitos que se pidieron; los que falten caen a frase motivacional. */
  habits: Record<string, Bilingual>;
};

/** Quita el cerco de markdown con el que algunos modelos envuelven el JSON. */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/.exec(trimmed);
  return (fenced?.[1] ?? trimmed).trim();
}

export function parseAdviceResponse(
  raw: string,
  requestedHabitIds: string[]
): ParsedAdvice {
  const text = stripCodeFence(raw);
  if (text === "") throw new Error("advice_response_empty");

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("advice_response_unparseable");
  }

  const result = adviceResponseSchema.safeParse(json);
  if (!result.success) throw new Error("advice_response_invalid");

  const requested = new Set(requestedHabitIds);
  const habits: Record<string, Bilingual> = {};
  for (const entry of result.data.habits) {
    if (!requested.has(entry.habitId)) continue;
    habits[entry.habitId] = { es: entry.es, en: entry.en };
  }

  return { home: { es: result.data.home.es, en: result.data.home.en }, habits };
}

/**
 * Columnas guardadas → consejo listo para pintar. Si falta cualquiera de los
 * dos idiomas no hay consejo, y la tarjeta cae a una frase motivacional.
 */
export function toBilingual(
  es: string | null | undefined,
  en: string | null | undefined
): Bilingual | null {
  return es && en ? { es, en } : null;
}

/** FNV-1a de 32 bits: reparte los ids de hábito por el catálogo de frases. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Frase motivacional del día. La vista de inicio usa el día del año; cada
 * hábito se desplaza desde ahí un salto no nulo derivado de su id, de modo que
 * su frase nunca coincide con la de inicio y dos hábitos sólo coinciden si sus
 * ids caen en el mismo salto.
 */
function motivationalIndex(
  count: number,
  dayOfYear: number,
  habitId?: string
): number {
  // LCG clásico: índice barajado que sólo cambia al cambiar el día
  const seed = (dayOfYear * 9301 + 49297) % 233280;
  const home = Math.floor((seed / 233280) * count);
  if (habitId === undefined || count < 2) return home;
  const step = 1 + (hashString(habitId) % (count - 1));
  return (home + step) % count;
}

/**
 * Texto final de una tarjeta de consejo: el consejo del día si lo hay y, si no,
 * una frase motivacional. El consejo llega en ambos idiomas, así que cambiar el
 * idioma de la app lo cambia al instante sin volver a generar.
 */
export function resolveAdviceText(input: {
  advice: Bilingual | null;
  locale: Locale;
  phrases: readonly string[];
  dayOfYear: number;
  /** Presente en el detalle de un hábito; ausente en la vista de inicio. */
  habitId?: string;
}): string {
  const { advice, locale, phrases, dayOfYear, habitId } = input;
  if (advice) return advice[locale];
  if (phrases.length === 0) return "";
  return phrases[motivationalIndex(phrases.length, dayOfYear, habitId)];
}
