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
 * Derives habit progress from logs at read time (never stored).
 * Walks each day from start_date to yesterday (today is not counted as
 * missed while it's still in progress):
 *  - day with a 'completed' log: +1
 *  - any other day: missed; if punishment is enabled and the habit is not
 *    indefinite, progress goes back 2 days (clamped at 0)
 */
export function computeHabitProgress(
  habit: Habit,
  logs: HabitLog[],
  todayStr: string
): HabitProgress {
  const completedSet = new Set(
    logs.filter((l) => l.status === "completed").map((l) => l.log_date)
  );

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
    } else {
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
  status: "completed" | "missed" | "future" | "before-start" | "today-pending";
};

/** Day states for a month grid (year, month 0-11). */
export function buildCalendarData(
  habit: Habit,
  logs: HabitLog[],
  todayStr: string,
  year: number,
  month: number
): CalendarDay[] {
  const completedSet = new Set(
    logs.filter((l) => l.status === "completed").map((l) => l.log_date)
  );
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

/** Chart series: completed days per ISO-ish week (start Monday) and cumulative progress. */
export function buildChartSeries(
  habit: Habit,
  logs: HabitLog[],
  todayStr: string
): { weekly: WeekPoint[]; cumulative: CumulativePoint[] } {
  const completed = logs
    .filter((l) => l.status === "completed" && l.log_date <= todayStr)
    .map((l) => l.log_date)
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
  const start = parseDate(habit.start_date);
  const totalDays = differenceInCalendarDays(parseDate(todayStr), start);
  const cumulative: CumulativePoint[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const date = formatDate(addDays(start, i));
    if (completedSet.has(date)) running += 1;
    else if (date < todayStr && punish) running = Math.max(0, running - 2);
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

export type HabitDayTask = Pick<Task, "status" | "due_date"> &
  Partial<Pick<Task, "completed_at">>;

/**
 * Decide si un día cuenta como día objetivo cumplido para un hábito.
 *
 * El contador de días objetivo sólo baja cuando *todas* las tareas de ese día
 * quedaron cerradas con éxito. Las tareas del día son las que vencen ese día
 * más las que se cerraron ese día aunque vinieran vencidas.
 *
 *  - alguna tarea del día fallada ('no') → el día no cuenta; tampoco resta ni
 *    rompe nada más: fuera del modo castigo un día fallado sólo deja el
 *    contador igual que estaba
 *  - alguna tarea vinculada pendiente con vencimiento hasta ese día → el día
 *    sigue abierto y no cuenta
 *  - ninguna tarea del día → no hay nada que acreditar
 */
export function isHabitDayCompleted(
  tasks: HabitDayTask[],
  day: string
): boolean {
  const ofTheDay = tasks.filter(
    (t) => t.due_date === day || t.completed_at?.startsWith(day)
  );
  if (ofTheDay.length === 0) return false;
  if (ofTheDay.some((t) => t.status !== "yes")) return false;
  return !tasks.some((t) => t.status === "pending" && t.due_date <= day);
}
