import { addDays, differenceInCalendarDays } from "date-fns";
import { formatDate, parseDate } from "@/lib/recurrence";
import type { Habit, HabitLog, Task } from "@/lib/types";

export type HabitProgress = {
  /** Net progress in days (punishment applied when it corresponds), min 0 */
  progress: number;
  /** Total target: target_days, or days between start and end_date, or null if indefinite */
  target: number | null;
  percent: number | null;
  completedDays: number;
  missedDays: number;
  currentStreak: number;
  bestStreak: number;
  completionRate: number;
  isIndefinite: boolean;
  isFinished: boolean;
};

/** Lo mínimo que hace falta saber de una tarea vinculada para juzgar un día. */
export type HabitDueTask = Pick<Task, "due_date">;

/**
 * Días en los que el hábito pedía algo: los que tienen alguna tarea vinculada
 * que vence en ellos. Un día que no está aquí es *neutro*: ni cumplido ni
 * fallado, no suma, no resta, no rompe la racha ni entra en la tasa. Ver
 * `docs/adr/0008-day-without-due-task-is-neutral.md`.
 */
export function requiredDays(linkedTasks: HabitDueTask[]): Set<string> {
  return new Set(linkedTasks.map((t) => t.due_date));
}

/**
 * Días acreditados según los logs. Hoy un log sólo puede ser 'completed'
 * (ADR 0009), pero el filtro se queda: una base a la que aún no se le haya
 * pasado la migración `0010` conserva filas 'missed' del backfill viejo, y
 * sin él contarían como días cumplidos.
 */
function accreditedDays(logs: HabitLog[]): Set<string> {
  return new Set(
    logs.filter((l) => l.status === "completed").map((l) => l.log_date)
  );
}

/** Una tarea vinculada vista desde el listado: a qué hábito y qué día. */
export type LinkedTaskDay = HabitDueTask & { habit_id: string };

/** Agrupa por hábito lo que `computeHabitProgress` necesita de cada uno. */
export function groupTaskDaysByHabit(
  taskDays: LinkedTaskDay[]
): Map<string, HabitDueTask[]> {
  const byHabit = new Map<string, HabitDueTask[]>();
  for (const { habit_id, due_date } of taskDays) {
    const list = byHabit.get(habit_id) ?? [];
    list.push({ due_date });
    byHabit.set(habit_id, list);
  }
  return byHabit;
}

export function isIndefinite(habit: Habit): boolean {
  return habit.target_days === null && habit.end_date === null;
}

function habitTarget(habit: Habit): number | null {
  if (habit.target_days !== null) return habit.target_days;
  if (habit.end_date !== null) {
    return (
      differenceInCalendarDays(parseDate(habit.end_date), parseDate(habit.start_date)) + 1
    );
  }
  return null;
}

/**
 * Deriva el progreso del hábito en lectura, a partir de los logs y de las
 * tareas vinculadas; nunca se guarda. Recorre cada día desde `start_date`
 * hasta ayer (hoy no cuenta como fallado mientras siga en curso):
 *  - día con log 'completed': +1 y alarga la racha
 *  - día en que vencía alguna tarea vinculada y no está cumplido: fallado;
 *    rompe la racha y, con castigo activo en un hábito finito, resta 2
 *    (nunca por debajo de 0)
 *  - día sin ninguna tarea vencida: neutro, no cambia nada
 */
export function computeHabitProgress(
  habit: Habit,
  logs: HabitLog[],
  linkedTasks: HabitDueTask[],
  todayStr: string
): HabitProgress {
  const completedSet = accreditedDays(logs);
  const required = requiredDays(linkedTasks);

  const indefinite = isIndefinite(habit);
  const target = habitTarget(habit);
  const punish = habit.punishment_enabled && !indefinite;

  const start = parseDate(habit.start_date);
  const today = parseDate(todayStr);
  const lastCounted = habit.end_date
    ? Math.min(
        differenceInCalendarDays(parseDate(habit.end_date), start),
        differenceInCalendarDays(today, start) - 1
      )
    : differenceInCalendarDays(today, start) - 1;

  let progress = 0;
  let completedDays = 0;
  let missedDays = 0;
  let streak = 0;
  let bestStreak = 0;

  for (let i = 0; i <= lastCounted; i++) {
    const day = formatDate(addDays(start, i));
    if (completedSet.has(day)) {
      progress += 1;
      completedDays += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else if (required.has(day)) {
      missedDays += 1;
      streak = 0;
      if (punish) progress = Math.max(0, progress - 2);
    }
  }

  // Today counts toward progress and streak if already completed
  if (completedSet.has(todayStr)) {
    progress += 1;
    completedDays += 1;
    streak += 1;
    bestStreak = Math.max(bestStreak, streak);
  }

  if (target !== null) progress = Math.min(progress, target);

  const observed = completedDays + missedDays;
  return {
    progress,
    target,
    percent: target === null ? null : Math.round((progress / target) * 100),
    completedDays,
    missedDays,
    currentStreak: streak,
    bestStreak,
    completionRate: observed === 0 ? 0 : Math.round((completedDays / observed) * 100),
    isIndefinite: indefinite,
    isFinished: target !== null && progress >= target,
  };
}

export type CalendarDay = {
  date: string;
  status:
    | "completed"
    | "missed"
    | "neutral"
    | "future"
    | "before-start"
    | "today-pending";
};

/**
 * Estado de cada día de un mes (year, month 0-11) para la rejilla del
 * calendario. `neutral` es un día dentro del rango del hábito en el que no
 * vencía ninguna tarea vinculada: no había nada que cumplir ni que fallar.
 */
export function buildCalendarData(
  habit: Habit,
  logs: HabitLog[],
  linkedTasks: HabitDueTask[],
  todayStr: string,
  year: number,
  month: number
): CalendarDay[] {
  const completedSet = accreditedDays(logs);
  const required = requiredDays(linkedTasks);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: CalendarDay[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = formatDate(new Date(year, month, d));
    let status: CalendarDay["status"];
    if (date < habit.start_date || (habit.end_date && date > habit.end_date)) {
      status = "before-start";
    } else if (completedSet.has(date)) {
      status = "completed";
    } else if (date > todayStr) {
      status = "future";
    } else if (!required.has(date)) {
      status = "neutral";
    } else if (date === todayStr) {
      status = "today-pending";
    } else {
      status = "missed";
    }
    days.push({ date, status });
  }
  return days;
}

export type WeekPoint = { week: string; completed: number };
export type CumulativePoint = { date: string; progress: number };

/**
 * Series para las gráficas: días cumplidos por semana (empezando en lunes) y
 * progreso acumulado. El castigo de la curva sólo se aplica en los días que
 * pedían algo; los neutros la dejan plana.
 */
export function buildChartSeries(
  habit: Habit,
  logs: HabitLog[],
  linkedTasks: HabitDueTask[],
  todayStr: string
): { weekly: WeekPoint[]; cumulative: CumulativePoint[] } {
  const completed = [...accreditedDays(logs)]
    .filter((date) => date <= todayStr)
    .sort();

  const weekly = new Map<string, number>();
  for (const date of completed) {
    const d = parseDate(date);
    const monday = addDays(d, -((d.getDay() + 6) % 7));
    const key = formatDate(monday);
    weekly.set(key, (weekly.get(key) ?? 0) + 1);
  }

  let running = 0;
  const punish = habit.punishment_enabled && !isIndefinite(habit);
  const completedSet = new Set(completed);
  const required = requiredDays(linkedTasks);
  const start = parseDate(habit.start_date);
  const totalDays = differenceInCalendarDays(parseDate(todayStr), start);
  const cumulative: CumulativePoint[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const date = formatDate(addDays(start, i));
    if (completedSet.has(date)) running += 1;
    else if (date < todayStr && punish && required.has(date)) {
      running = Math.max(0, running - 2);
    }
    cumulative.push({ date, progress: running });
  }

  return {
    weekly: [...weekly.entries()].map(([week, count]) => ({
      week,
      completed: count,
    })),
    cumulative,
  };
}

/** Lo que hace falta para acreditar un día: además del vencimiento, cómo acabó. */
export type HabitDayTask = HabitDueTask & Pick<Task, "status">;

/**
 * Decide si un día cuenta como día objetivo cumplido para un hábito.
 *
 * El día lo juzgan sus propias tareas: las que *vencían* ese día. Cuándo se
 * cerraron no interviene, así que completar hoy algo que vencía ayer acredita
 * ayer, que es el día al que pertenecía el compromiso.
 *
 *  - alguna tarea del día fallada ('no') o todavía pendiente → el día no
 *    cuenta; fuera del modo castigo tampoco resta nada, sólo deja el contador
 *    como estaba
 *  - ninguna tarea vencía ese día → no hay nada que acreditar
 *
 * Las tareas vencidas de otros días no bloquean este: una deuda arrastrada no
 * puede desacreditar un día que sí se cumplió. Ver
 * `docs/adr/0005-habit-day-judged-by-due-date.md`.
 */
export function isHabitDayCompleted(
  tasks: HabitDayTask[],
  day: string
): boolean {
  const ofTheDay = tasks.filter((t) => t.due_date === day);
  if (ofTheDay.length === 0) return false;
  return ofTheDay.every((t) => t.status === "yes");
}
