import { NextResponse } from "next/server";
import { z } from "zod";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";
import { syncHabitDaysForTask } from "@/app/api/_lib/habit-day";
import { getNextDueDate } from "@/lib/recurrence";
import type { Task } from "@/lib/types";

const completeSchema = z.object({ status: z.enum(["yes", "no"]) });

/**
 * Completing a task:
 * 1. marks it yes/no
 * 2. writes the permanent completion log
 * 3. if recurring, creates the next instance (subtasks reset)
 * 4. recomputes the habit days its due dates affect, for every linked habit
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) return jsonError("invalid_payload", 400);

  const { data: task, error: fetchError } = await ctx.supabase
    .from("tasks")
    .select("*, subtasks(*)")
    .eq("id", id)
    .single<Task>();

  if (fetchError || !task) return jsonError("not_found", 404);
  if (task.status !== "pending") return jsonError("already_completed", 409);

  const now = new Date();

  const { error: completionError } = await ctx.supabase
    .from("task_completions")
    .insert({
      task_id: task.id,
      user_id: ctx.user.id,
      title_snapshot: task.title,
      status: parsed.data.status,
      due_date: task.due_date,
    });
  if (completionError) return jsonError(completionError.message, 500);

  const { data: updated, error: updateError } = await ctx.supabase
    .from("tasks")
    .update({ status: parsed.data.status, completed_at: now.toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (updateError) return jsonError(updateError.message, 500);

  const { data: habitLinks } = await ctx.supabase
    .from("habit_tasks")
    .select("habit_id")
    .eq("task_id", task.id);

  // Next instance for recurring tasks: always one interval after the original
  // due date, regardless of when it was marked. An overdue task stays overdue
  // (its next occurrence can still be in the past) — being late never shifts
  // the cadence forward.
  let nextTask: Task | null = null;
  const nextDue = getNextDueDate(task, task.due_date);
  if (nextDue) {
    const { data: created, error: nextError } = await ctx.supabase
      .from("tasks")
      .insert({
        user_id: ctx.user.id,
        category_id: task.category_id,
        title: task.title,
        description: task.description,
        link: task.link,
        due_date: nextDue,
        priority: task.priority,
        pomodoro_minutes: task.pomodoro_minutes,
        recurrence_type: task.recurrence_type,
        recurrence_weekdays: task.recurrence_weekdays,
        recurrence_interval: task.recurrence_interval,
        recurrence_parent_id: task.recurrence_parent_id ?? task.id,
      })
      .select()
      .single();
    if (nextError) return jsonError(nextError.message, 500);
    nextTask = created;

    const subtasks = task.subtasks ?? [];
    if (subtasks.length > 0) {
      await ctx.supabase.from("subtasks").insert(
        subtasks.map((s) => ({
          task_id: created.id,
          user_id: ctx.user.id,
          title: s.title,
          position: s.position,
          is_done: false,
        }))
      );
    }

    // The next instance inherits the habit links so future days keep counting
    if (habitLinks && habitLinks.length > 0) {
      await ctx.supabase.from("habit_tasks").insert(
        habitLinks.map((h) => ({
          habit_id: h.habit_id,
          task_id: created.id,
          user_id: ctx.user.id,
        }))
      );
    }
  }

  // El día objetivo sólo baja cuando TODAS las tareas del hábito que vencían
  // ese día quedaron cerradas con éxito. Se recalcula el día de vencimiento de
  // la tarea —no el de hoy—, así que cerrarla tarde acredita el día al que
  // pertenecía. Se recalcula también al marcar 'no' para que una tarea fallada
  // deshaga un día que ya se hubiera acreditado.
  //
  // La instancia siguiente puede nacer con una fecha ya pasada (una tarea
  // vencida no desplaza su cadencia), y entonces ese día vuelve a tener una
  // tarea pendiente: hay que recalcularlo también o se quedaría acreditado.
  if (habitLinks && habitLinks.length > 0) {
    const days = [task.due_date];
    if (nextTask) days.push(nextTask.due_date);
    await syncHabitDaysForTask(ctx, task.id, days);
  }

  return NextResponse.json({ task: updated, nextTask });
}
