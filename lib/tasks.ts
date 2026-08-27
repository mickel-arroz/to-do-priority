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
 * Clave de la serie de recurrencia a la que pertenece una tarea. Al completar
 * una tarea recurrente se crea la siguiente instancia con
 * `recurrence_parent_id` apuntando al original, así que todas las repeticiones
 * comparten clave. Una tarea sin recurrencia es su propia serie.
 */
export function recurrenceSeriesKey(task: Task): string {
  return task.recurrence_parent_id ?? task.id;
}

/** Gana la abierta; entre abiertas la que vence antes, entre cerradas la última. */
function isBetterRepresentative(candidate: Task, incumbent: Task): boolean {
  const candidateOpen = candidate.status === "pending";
  const incumbentOpen = incumbent.status === "pending";
  if (candidateOpen !== incumbentOpen) return candidateOpen;
  return candidateOpen
    ? candidate.due_date < incumbent.due_date
    : candidate.due_date > incumbent.due_date;
}

/**
 * Una sola tarea por serie de recurrencia: la que importa ahora.
 *
 * Las instancias de una tarea recurrente heredan el vínculo al hábito para que
 * los días siguientes sigan contando, así que con el tiempo se acumula una fila
 * por cada vez que la tarea se ha repetido. Para saber qué afecta al hábito
 * sirve la ocurrencia viva —o la más reciente, si la serie ya está cerrada—,
 * no el historial entero.
 */
export function dedupeRecurrenceSeries(tasks: Task[]): Task[] {
  const bySeries = new Map<string, Task>();
  for (const task of tasks) {
    const key = recurrenceSeriesKey(task);
    const incumbent = bySeries.get(key);
    if (!incumbent || isBetterRepresentative(task, incumbent)) {
      bySeries.set(key, task);
    }
  }
  return [...bySeries.values()];
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
