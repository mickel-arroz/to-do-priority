import type { AuthContext } from "@/app/api/_lib/auth";
import { isHabitDayCompleted } from "@/lib/habits";
import type { HabitDayTask } from "@/lib/habits";

/**
 * Reescribe el log de un día concreto de un hábito a partir del estado real
 * de sus tareas vinculadas. Es la única puerta por la que un día pasa a
 * contar dentro de los días objetivo.
 *
 * Sólo se leen las tareas que vencen ese día: el filtro va en la query, no en
 * memoria, para que el coste no crezca con la historia del hábito y para no
 * chocar con el tope de filas de PostgREST.
 *
 * Sólo escribe o borra la fila 'completed': un día no cumplido nunca se marca
 * aquí como fallado, porque fuera del modo castigo no debe restar nada. El
 * backfill de `POST /api/habits/[id]/logs` es quien rellena los 'missed'
 * pasados para que el calendario los pueda pintar.
 */
export async function syncHabitDay(
  ctx: AuthContext,
  habitId: string,
  day: string
) {
  const { data: linked } = await ctx.supabase
    .from("habit_tasks")
    .select("tasks!inner(status, due_date)")
    .eq("habit_id", habitId)
    .eq("tasks.due_date", day);

  const tasks = (linked ?? []).map(
    (l) => l.tasks as unknown as HabitDayTask
  );

  if (isHabitDayCompleted(tasks, day)) {
    await ctx.supabase.from("habit_logs").upsert(
      {
        habit_id: habitId,
        user_id: ctx.user.id,
        log_date: day,
        status: "completed" as const,
      },
      { onConflict: "habit_id,log_date" }
    );
    return;
  }

  await ctx.supabase
    .from("habit_logs")
    .delete()
    .eq("habit_id", habitId)
    .eq("log_date", day)
    .eq("status", "completed");
}

/**
 * Recalcula cada día indicado para cada hábito indicado. Cualquier mutación
 * que cambie qué tareas vencen un día de un hábito —completar, deshacer,
 * mover el vencimiento, borrar la tarea, vincularla o desvincularla— tiene
 * que pasar por aquí con los días que abandona y los que estrena.
 */
export async function syncHabitDays(
  ctx: AuthContext,
  habitIds: string[],
  days: string[]
) {
  const uniqueHabits = [...new Set(habitIds)];
  const uniqueDays = [...new Set(days)];
  if (uniqueHabits.length === 0 || uniqueDays.length === 0) return;

  await Promise.all(
    uniqueHabits.flatMap((habitId) =>
      uniqueDays.map((day) => syncHabitDay(ctx, habitId, day))
    )
  );
}

/** Hábitos a los que está vinculada una tarea. */
export async function linkedHabitIds(
  ctx: AuthContext,
  taskId: string
): Promise<string[]> {
  const { data: links } = await ctx.supabase
    .from("habit_tasks")
    .select("habit_id")
    .eq("task_id", taskId);
  return (links ?? []).map((l) => l.habit_id as string);
}

/** Días de vencimiento de un conjunto de tareas, sin repetir. */
export async function dueDatesOf(
  ctx: AuthContext,
  taskIds: string[]
): Promise<string[]> {
  if (taskIds.length === 0) return [];
  const { data: tasks } = await ctx.supabase
    .from("tasks")
    .select("due_date")
    .in("id", taskIds);
  return [...new Set((tasks ?? []).map((t) => t.due_date as string))];
}

/**
 * Recalcula los días indicados para todos los hábitos vinculados a una tarea.
 *
 * Los días llegan del `due_date` de las tareas que han cambiado, no de "hoy":
 * un día se acredita por lo que vencía en él, así que cerrar tarde una tarea
 * tiene que repintar el día al que pertenecía. Ver
 * `docs/adr/0005-habit-day-judged-by-due-date.md`.
 *
 * Resuelve los vínculos en el momento de la llamada: si la tarea ya no existe
 * o ya se desvinculó, hay que capturar los hábitos antes y usar
 * `syncHabitDays`.
 */
export async function syncHabitDaysForTask(
  ctx: AuthContext,
  taskId: string,
  days: string[]
) {
  if (days.length === 0) return;
  const habits = await linkedHabitIds(ctx, taskId);
  await syncHabitDays(ctx, habits, days);
}
