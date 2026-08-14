import type { Task, TaskCompletion } from "@/lib/types";

/** Priority 1 first; ties broken by earlier due date, then title. */
export function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      a.priority - b.priority ||
      a.due_date.localeCompare(b.due_date) ||
      a.title.localeCompare(b.title)
  );
}

/** Nearest date first; ties broken by priority. */
export function sortByDateAndPriority(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      a.due_date.localeCompare(b.due_date) ||
      a.priority - b.priority ||
      a.title.localeCompare(b.title)
  );
}

/**
 * Splits pending tasks into "today" (due today or overdue) and "upcoming".
 * `today` is a yyyy-MM-dd string to avoid timezone drift.
 */
export function partitionTasks(
  tasks: Task[],
  today: string
): { pending: Task[]; upcoming: Task[] } {
  const open = tasks.filter((t) => t.status === "pending");
  return {
    pending: sortByPriority(open.filter((t) => t.due_date <= today)),
    upcoming: sortByDateAndPriority(open.filter((t) => t.due_date > today)),
  };
}

/**
 * Today's completed tasks for the bottom of the Pendientes section:
 * priority first, then completion order (earliest completion first).
 */
export function sortCompletedToday(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.completed_at ?? "").localeCompare(b.completed_at ?? "")
  );
}

/** Stats for the Home progress bar: tasks finished today vs total for today. */
export function todayCompletionStats(
  pendingToday: Task[],
  completions: TaskCompletion[],
  todayIso: string
): { done: number; total: number; percent: number } {
  const done = completions.filter((c) =>
    c.completed_at.startsWith(todayIso)
  ).length;
  const total = pendingToday.length + done;
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}
