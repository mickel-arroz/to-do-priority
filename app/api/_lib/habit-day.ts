import type { AuthContext } from "@/app/api/_lib/auth";
import { isHabitDayCompleted } from "@/lib/habits";
import type { HabitDayTask } from "@/lib/habits";

/**
 * Reescribe el log de un día concreto de un hábito a partir del estado real
 * de sus tareas vinculadas. Es la única puerta por la que un día pasa a
 * contar dentro de los días objetivo.
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
    .select("tasks!inner(status, due_date, completed_at)")
    .eq("habit_id", habitId);

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

/** Recalcula el día para todos los hábitos vinculados a una tarea. */
export async function syncHabitDaysForTask(
  ctx: AuthContext,
  taskId: string,
  day: string
) {
  const { data: links } = await ctx.supabase
    .from("habit_tasks")
    .select("habit_id")
    .eq("task_id", taskId);
  if (!links || links.length === 0) return;

  for (const { habit_id } of links) {
    await syncHabitDay(ctx, habit_id, day);
  }
}
