import { addDays } from "date-fns";
import { z } from "zod";
import {
  summarizeAvailability,
  type AvailabilitySummary,
  type BusyBlockInput,
} from "@/lib/availability";
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
/** Las descripciones de tarea no se envían nunca; las de hábito, truncadas. */
export const HABIT_DESCRIPTION_LIMIT = 500;
/** Ventana, en días, hacia atrás (vencidas, completadas) y hacia delante (próximas). */
export const ADVICE_WINDOW_DAYS = 7;

export type AdviceTaskSummary = {
  title: string;
  priority: Priority;
  dueDate: string;
  /** Minutos de pomodoro configurados, o null si la tarea no lo usa. */
  pomodoroMinutes: number | null;
};

/**
 * El pomodoro es opcional: 0 significa apagado, no "cuesta cero minutos". Se
 * traduce a null para que el modelo no lo lea como una estimación de tiempo.
 */
function pomodoroMinutes(task: Task): number | null {
  return task.pomodoro_minutes > 0 ? task.pomodoro_minutes : null;
}

/** Una tarea pendiente vinculada a un hábito, con lo que hace falta para aconsejar sobre ella. */
export type AdviceHabitTask = {
  title: string;
  /** Los pasos de la tarea, en orden: dicen en qué consiste el trabajo. */
  subtasks: { title: string; done: boolean }[];
  dueDate: string;
  priority: Priority;
  /** Minutos de pomodoro configurados, o null si la tarea no lo usa. */
  pomodoroMinutes: number | null;
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
  /** Lo que queda por hacer: va entero, por prioridad. */
  pendingTasks: AdviceHabitTask[];
  /** De lo ya resuelto sólo interesa cuánto salió bien y cuánto se falló. */
  completedTasks: number;
  failedTasks: number;
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
  /**
   * Tiempo del que el usuario dispone de verdad. Va siempre, configurado o no:
   * sin él la IA reparte 24 horas al día. Ver `lib/availability.ts`.
   */
  availability: AvailabilitySummary;
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
  /** Tiempo ocupado de la semana tipo; ausente = disponibilidad sin configurar. */
  busyBlocks?: BusyBlockInput[];
}): AdvicePayload {
  const { tasks, habits, logs, today, busyBlocks } = input;
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
    availability: summarizeAvailability(busyBlocks ?? []),
    pending: sortByPriority(open)
      .slice(0, ADVICE_MAX_PENDING_TASKS)
      .map((t) => ({
        title: t.title,
        priority: t.priority,
        dueDate: t.due_date,
        pomodoroMinutes: pomodoroMinutes(t),
      })),
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
        const linked = linkedTaskIds([h])
          .map((id) => tasksById.get(id))
          .filter((t): t is Task => t !== undefined);
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
          pendingTasks: sortByPriority(
            linked.filter((t) => t.status === "pending")
          ).map((t) => ({
            title: t.title,
            subtasks: [...(t.subtasks ?? [])]
              .sort((a, b) => a.position - b.position)
              .map((s) => ({ title: s.title, done: s.is_done })),
            dueDate: t.due_date,
            priority: t.priority,
            pomodoroMinutes: pomodoroMinutes(t),
          })),
          completedTasks: linked.filter((t) => t.status === "yes").length,
          failedTasks: linked.filter((t) => t.status === "no").length,
        };
      }),
  };
}

/**
 * Sin nada que contar no se reclama el día ni se llama a la IA. La
 * disponibilidad no cuenta: es contexto para aconsejar, no algo sobre lo que
 * aconsejar, así que por sí sola nunca dispara una generación.
 */
export function isAdvicePayloadEmpty(payload: AdvicePayload): boolean {
  return (
    payload.pending.length === 0 &&
    payload.habits.length === 0 &&
    payload.completedLastWeek === 0 &&
    payload.failedLastWeek === 0
  );
}

/**
 * Intentos de generación que se permiten por usuario y día.
 *
 * Un fallo del proveedor no puede costar el día entero: la latencia de los
 * modelos es irregular y el intento siguiente suele salir bien. Pero tampoco
 * se reintenta en bucle, que es lo que el diseño original quería evitar: unos
 * pocos tiros y se para hasta mañana.
 *
 * Lo mismo decide `claim_advice_day` en la migración 0007, que es quien manda:
 * aquí se repite para cortar antes de gastar una llamada a la base.
 */
export const ADVICE_ATTEMPTS_PER_DAY = 3;

/** La fila de estado del usuario, que es todo lo que hace falta para saber si toca generar. */
export type AdviceDayState = {
  lastAttemptDate: string | null;
  lastAdviceDate: string | null;
  attemptCount: number;
};

/**
 * ¿Queda algo que intentar hoy? Se responde sólo con la fila de estado, sin
 * mirar los datos del usuario, y por eso se comprueba aparte de
 * `shouldGenerateAdvice`: en la inmensa mayoría de las navegaciones el consejo
 * de hoy ya está guardado y basta con esto para no leer ninguna otra tabla.
 */
export function canAttemptAdviceToday(
  state: AdviceDayState,
  today: string
): boolean {
  // Ya hay consejo de hoy: no hay nada que generar.
  if (state.lastAdviceDate === today) return false;
  // Día nuevo: el contador de ayer no cuenta.
  if (state.lastAttemptDate !== today) return true;
  return state.attemptCount < ADVICE_ATTEMPTS_PER_DAY;
}

export function shouldGenerateAdvice(input: {
  payload: AdvicePayload;
  state: AdviceDayState;
  today: string;
}): boolean {
  if (!canAttemptAdviceToday(input.state, input.today)) return false;
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
