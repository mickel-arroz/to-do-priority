import { addDays } from "date-fns";
import { z } from "zod";
import {
  summarizeAvailability,
  weekdayName,
  type AvailabilitySummary,
  type BusyBlockInput,
  type WeekdayName,
} from "@/lib/availability";
import { buildChartSeries, computeHabitProgress } from "@/lib/habits";
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
/**
 * Tope de títulos por lista en la actividad desde el consejo anterior: si el
 * usuario lleva semanas sin entrar, basta con lo más reciente para juzgar si
 * siguió el consejo.
 */
export const ADVICE_MAX_ACTIVITY_TITLES = 20;
/**
 * Hasta dónde se mira hacia atrás la actividad desde el consejo anterior. Un
 * usuario que vuelve tras meses no necesita su historial entero: basta con el
 * último mes, y la query no crece sin límite.
 */
export const ADVICE_MAX_FOLLOW_UP_DAYS = 30;
/**
 * Tope de hábitos, activos o terminados, que el consejo de inicio ve en su
 * resumen de hábitos. Los activos van primero, así que el recorte sólo se
 * lleva los terminados más viejos.
 */
export const ADVICE_MAX_OVERVIEW_HABITS = 30;
/** Semanas de las gráficas de cada hábito que viajan resumidas al prompt. */
export const ADVICE_CHART_WEEKS = 8;

export type AdviceTaskSummary = {
  title: string;
  priority: Priority;
  dueDate: string;
  dueWeekday: WeekdayName;
  /** Minutos de pomodoro configurados, o null si la tarea no lo usa. */
  pomodoroMinutes: number | null;
};

/** Un consejo ya guardado, en español, con el día del usuario en que se generó. */
export type PreviousAdvice = { text: string; date: string };

/**
 * Lo que el usuario hizo desde el consejo de inicio anterior, para que la IA
 * juzgue si lo siguió. Títulos, no conteos: el consejo nombraba tareas.
 */
export type AdviceActivitySince = {
  since: string;
  /** Lo más reciente primero, recortado a ADVICE_MAX_ACTIVITY_TITLES. */
  completed: string[];
  failed: string[];
  /** Pendientes cuyo vencimiento cayó desde entonces y antes de hoy. */
  overdue: string[];
};

/** Cómo se movió un hábito desde su consejo anterior. */
export type AdviceHabitEvolution = {
  completedDays: number;
  missedDays: number;
  /** Progreso y racha tal y como estaban el día del consejo anterior. */
  progressThen: number;
  streakThen: number;
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
  dueWeekday: WeekdayName;
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
  /** El último consejo de este hábito, o null si nunca tuvo. */
  previousAdvice: PreviousAdvice | null;
  sincePreviousAdvice: AdviceHabitEvolution | null;
};

/**
 * Cómo está un hábito visto desde el consejo de inicio:
 * - "active": sigue en curso.
 * - "completed": alcanzó su objetivo.
 * - "ended": su fecha de fin pasó sin alcanzarlo (o, si era abierto, sin más).
 */
export type AdviceHabitStatus = "active" | "completed" | "ended";

/** Una semana de las gráficas del hábito: días cumplidos y progreso al cerrarla. */
export type AdviceHabitWeek = {
  /** Lunes de la semana, "yyyy-MM-dd". */
  weekStart: string;
  completedDays: number;
  progressAtEnd: number;
};

/**
 * Un hábito, activo o terminado, tal y como lo ve el consejo de inicio: su
 * intención, si lo logró y lo que cuentan sus estadísticas y gráficas. No
 * lleva id ni pasos de tareas: no es material para un consejo propio, que
 * sigue saliendo de `habits`, sino contexto para leer la situación global.
 */
export type AdviceHabitOverview = {
  name: string;
  description: string | null;
  status: AdviceHabitStatus;
  isIndefinite: boolean;
  startDate: string;
  endDate: string | null;
  progress: number;
  target: number | null;
  /** Progreso sobre el objetivo, o null si el hábito es abierto. */
  percent: number | null;
  completedDays: number;
  missedDays: number;
  currentStreak: number;
  bestStreak: number;
  completionRate: number;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  /**
   * Las últimas ADVICE_CHART_WEEKS semanas de sus gráficas (días cumplidos por
   * semana y progreso acumulado), hasta hoy o hasta que el hábito terminó.
   */
  recentWeeks: AdviceHabitWeek[];
};

export type AdvicePayload = {
  today: string;
  todayWeekday: WeekdayName;
  /** El último consejo de inicio, o null si nunca hubo: se genera como siempre. */
  previousAdvice: (PreviousAdvice & { weekday: WeekdayName }) | null;
  sincePreviousAdvice: AdviceActivitySince | null;
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
   * Todos los hábitos del usuario, activos y terminados, para el consejo de
   * inicio. No genera consejos por hábito: ésos salen sólo de `habits`.
   */
  habitsOverview: AdviceHabitOverview[];
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
 * más: si la ventana cambia, cambian las dos a la vez. Un consejo anterior más
 * viejo que la ventana la alarga hasta donde empieza su seguimiento.
 */
export function adviceWindowStart(
  today: string,
  previousAdviceDate?: string | null
): string {
  const weekAgo = shift(today, -ADVICE_WINDOW_DAYS);
  if (!previousAdviceDate) return weekAgo;
  const followUp = followUpStart(today, previousAdviceDate);
  return followUp < weekAgo ? followUp : weekAgo;
}

/**
 * Desde qué día se cuenta la actividad que sigue a un consejo: su fecha, pero
 * nunca más atrás de ADVICE_MAX_FOLLOW_UP_DAYS.
 */
function followUpStart(today: string, previousAdviceDate: string): string {
  const limit = shift(today, -ADVICE_MAX_FOLLOW_UP_DAYS);
  return previousAdviceDate < limit ? limit : previousAdviceDate;
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
function isFinishedHabit(
  habit: Habit,
  logs: HabitLog[],
  linked: Task[],
  today: string
): boolean {
  if (habit.end_date !== null && habit.end_date < today) return true;
  return computeHabitProgress(habit, logs, linked, today).isFinished;
}

/** Los activos primero y, dentro de cada grupo, los empezados más tarde. */
function byOverviewRelevance(a: AdviceHabitOverview, b: AdviceHabitOverview): number {
  const rank = (h: AdviceHabitOverview) => (h.status === "active" ? 0 : 1);
  return rank(a) - rank(b) || b.startDate.localeCompare(a.startDate);
}

function summarizeHabitForOverview(
  habit: Habit,
  logs: HabitLog[],
  linked: Task[],
  today: string
): AdviceHabitOverview {
  const progress = computeHabitProgress(habit, logs, linked, today);
  const ended = habit.end_date !== null && habit.end_date < today;
  const status: AdviceHabitStatus = progress.isFinished
    ? "completed"
    : ended
      ? "ended"
      : "active";

  // Las gráficas se leen hasta donde el hábito tuvo vida: un hábito que acabó
  // hace meses no tiene nada que contar en las últimas semanas de hoy.
  const { weekly, cumulative } = buildChartSeries(habit, logs, linked, today);
  const lastLog = [...logs]
    .map((l) => l.log_date)
    .filter((d) => d <= today)
    .sort()
    .at(-1);
  const until =
    status === "ended"
      ? (habit.end_date as string)
      : status === "completed"
        ? (lastLog ?? today)
        : today;

  return {
    name: habit.name,
    description: habit.description?.slice(0, HABIT_DESCRIPTION_LIMIT) ?? null,
    status,
    isIndefinite: progress.isIndefinite,
    startDate: habit.start_date,
    endDate: habit.end_date,
    progress: progress.progress,
    target: progress.target,
    percent: progress.percent,
    completedDays: progress.completedDays,
    missedDays: progress.missedDays,
    currentStreak: progress.currentStreak,
    bestStreak: progress.bestStreak,
    completionRate: progress.completionRate,
    completedTasks: linked.filter((t) => t.status === "yes").length,
    failedTasks: linked.filter((t) => t.status === "no").length,
    pendingTasks: linked.filter((t) => t.status === "pending").length,
    recentWeeks: recentChartWeeks(habit.start_date, until, weekly, cumulative),
  };
}

/**
 * Resume las dos gráficas del hábito en sus últimas semanas hasta `until`:
 * cuántos días se cumplieron en cada una y dónde quedó el progreso acumulado
 * al cerrarla. Las semanas sin días cumplidos van con 0, que también es dato.
 */
function recentChartWeeks(
  startDate: string,
  until: string,
  weekly: { week: string; completed: number }[],
  cumulative: { date: string; progress: number }[]
): AdviceHabitWeek[] {
  if (until < startDate) return [];
  const completedByWeek = new Map(weekly.map((w) => [w.week, w.completed]));
  const progressByDate = new Map(cumulative.map((p) => [p.date, p.progress]));
  const end = parseDate(until);
  const lastMonday = addDays(end, -((end.getDay() + 6) % 7));
  const firstStart = parseDate(startDate);
  const firstMonday = addDays(firstStart, -((firstStart.getDay() + 6) % 7));

  const weeks: AdviceHabitWeek[] = [];
  for (let i = ADVICE_CHART_WEEKS - 1; i >= 0; i--) {
    const monday = addDays(lastMonday, -7 * i);
    if (monday < firstMonday) continue;
    const sunday = formatDate(addDays(monday, 6));
    const closing = sunday < until ? sunday : until;
    weeks.push({
      weekStart: formatDate(monday),
      completedDays: completedByWeek.get(formatDate(monday)) ?? 0,
      progressAtEnd: progressByDate.get(closing) ?? progressByDate.get(until) ?? 0,
    });
  }
  return weeks;
}

export function buildAdvicePayload(input: {
  /** Tareas del usuario en cualquier estado; las descripciones se descartan. */
  tasks: Task[];
  habits: Habit[];
  logs: HabitLog[];
  today: string;
  /** Tiempo ocupado de la semana tipo; ausente = disponibilidad sin configurar. */
  busyBlocks?: BusyBlockInput[];
  /** Horas de sueño del usuario; ausente = DEFAULT_SLEEP_HOURS. */
  sleepHours?: number;
  /**
   * Los consejos guardados antes de esta generación, leídos antes de
   * sobrescribirlos. Ausente = primera generación del usuario.
   */
  previousAdvice?: {
    home: PreviousAdvice | null;
    /** Por id de hábito. */
    habits: Record<string, PreviousAdvice>;
  };
}): AdvicePayload {
  const { tasks, habits, logs, today, busyBlocks, sleepHours } = input;
  const previousHome = input.previousAdvice?.home ?? null;
  const previousByHabit = input.previousAdvice?.habits ?? {};
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

  // Lo resuelto desde una fecha, lo más reciente primero.
  const resolvedSince = (status: TaskStatus, since: string) =>
    tasks
      .filter(
        (t): t is Task & { completed_at: string } =>
          t.status === status &&
          t.completed_at !== null &&
          t.completed_at.slice(0, 10) >= since
      )
      .sort((a, b) => b.completed_at.localeCompare(a.completed_at))
      .slice(0, ADVICE_MAX_ACTIVITY_TITLES)
      .map((t) => t.title);

  const activitySince = (since: string): AdviceActivitySince => ({
    since,
    completed: resolvedSince("yes", since),
    failed: resolvedSince("no", since),
    overdue: open
      .filter((t) => t.due_date >= since && t.due_date < today)
      .sort((a, b) => b.due_date.localeCompare(a.due_date))
      .slice(0, ADVICE_MAX_ACTIVITY_TITLES)
      .map((t) => t.title),
  });

  const logsByHabit = new Map<string, HabitLog[]>();
  for (const log of logs) {
    const list = logsByHabit.get(log.habit_id) ?? [];
    list.push(log);
    logsByHabit.set(log.habit_id, list);
  }

  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const linkedTo = (h: Habit) =>
    linkedTaskIds([h])
      .map((id) => tasksById.get(id))
      .filter((t): t is Task => t !== undefined);

  return {
    today,
    todayWeekday: weekdayName(today),
    previousAdvice: previousHome && {
      ...previousHome,
      weekday: weekdayName(previousHome.date),
    },
    sincePreviousAdvice:
      previousHome && activitySince(followUpStart(today, previousHome.date)),
    availability: summarizeAvailability(busyBlocks ?? [], sleepHours),
    pending: sortByPriority(open)
      .slice(0, ADVICE_MAX_PENDING_TASKS)
      .map((t) => ({
        title: t.title,
        priority: t.priority,
        dueDate: t.due_date,
        dueWeekday: weekdayName(t.due_date),
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
    habitsOverview: habits
      .map((h) =>
        summarizeHabitForOverview(h, logsByHabit.get(h.id) ?? [], linkedTo(h), today)
      )
      .sort(byOverviewRelevance)
      .slice(0, ADVICE_MAX_OVERVIEW_HABITS),
    habits: habits
      .map((h) => ({ h, logs: logsByHabit.get(h.id) ?? [], linked: linkedTo(h) }))
      .filter(({ h, logs, linked }) => !isFinishedHabit(h, logs, linked, today))
      .map(({ h, logs, linked }) => {
        const progress = computeHabitProgress(h, logs, linked, today);
        const previous = previousByHabit[h.id] ?? null;
        // El hábito tal y como estaba al llegar el consejo. El día del consejo
        // cuenta entero como posterior: el consejo sale en la primera
        // navegación, así que lo hecho ese día casi siempre vino después. Por
        // eso se quitan sus logs, y como "hoy" tampoco cuenta como fallado.
        const atPreviousAdvice =
          previous &&
          computeHabitProgress(
            h,
            logs.filter((l) => l.log_date < previous.date),
            linked,
            previous.date
          );
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
            dueWeekday: weekdayName(t.due_date),
            priority: t.priority,
            pomodoroMinutes: pomodoroMinutes(t),
          })),
          completedTasks: linked.filter((t) => t.status === "yes").length,
          failedTasks: linked.filter((t) => t.status === "no").length,
          previousAdvice: previous,
          sincePreviousAdvice: atPreviousAdvice && {
            completedDays:
              progress.completedDays - atPreviousAdvice.completedDays,
            missedDays: progress.missedDays - atPreviousAdvice.missedDays,
            progressThen: atPreviousAdvice.progress,
            streakThen: atPreviousAdvice.currentStreak,
          },
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
