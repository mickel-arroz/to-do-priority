import { NextResponse } from "next/server";
import { z } from "zod";
import { format } from "date-fns";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";
import type { AuthContext } from "@/app/api/_lib/auth";
import type { Task } from "@/lib/types";

const statusSchema = z.object({ status: z.enum(["pending", "yes", "no"]) });

/**
 * Edits the status of an already-completed task: switch yes<->no or unmark
 * it back to pending (a task can be completed by mistake). Keeps the
 * completion log, recurring next instance and habit logs consistent.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) return jsonError("invalid_payload", 400);
  const target = parsed.data.status;

  const { data: task } = await ctx.supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single<Task>();
  if (!task) return jsonError("not_found", 404);
  if (task.status === "pending") return jsonError("not_completed", 409);
  if (task.status === target) return NextResponse.json({ task });

  const today = format(new Date(), "yyyy-MM-dd");

  // Latest completion log row for this task
  const { data: lastCompletion } = await ctx.supabase
    .from("task_completions")
    .select("id")
    .eq("task_id", id)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (target === "pending") {
    // Revert: back to pending, wipe the erroneous log entry and the
    // auto-created next recurring instance (if still pending)
    if (lastCompletion) {
      await ctx.supabase
        .from("task_completions")
        .delete()
        .eq("id", lastCompletion.id);
    }
    if (task.recurrence_type !== "none" && task.completed_at) {
      await ctx.supabase
        .from("tasks")
        .delete()
        .eq("status", "pending")
        .eq("recurrence_parent_id", task.recurrence_parent_id ?? task.id)
        .gte("created_at", task.completed_at);
    }
    const { data: updated, error } = await ctx.supabase
      .from("tasks")
      .update({ status: "pending", completed_at: null })
      .eq("id", id)
      .select()
      .single();
    if (error) return jsonError(error.message, 500);
    await syncHabitLogsForTask(ctx, id, today);
    return NextResponse.json({ task: updated });
  }

  // Switch yes <-> no: update the task and its latest log entry
  const { data: updated, error } = await ctx.supabase
    .from("tasks")
    .update({ status: target })
    .eq("id", id)
    .select()
    .single();
  if (error) return jsonError(error.message, 500);

  if (lastCompletion) {
    await ctx.supabase
      .from("task_completions")
      .update({ status: target })
      .eq("id", lastCompletion.id);
  }
  await syncHabitLogsForTask(ctx, id, today);
  return NextResponse.json({ task: updated });
}

/**
 * Recomputes today's habit log for every habit linked to the task: the day
 * is completed iff no linked task due by today is pending and at least one
 * was completed with 'yes' today.
 */
async function syncHabitLogsForTask(
  ctx: AuthContext,
  taskId: string,
  today: string
) {
  const { data: habitLinks } = await ctx.supabase
    .from("habit_tasks")
    .select("habit_id")
    .eq("task_id", taskId);
  if (!habitLinks || habitLinks.length === 0) return;

  for (const { habit_id } of habitLinks) {
    const { data: linked } = await ctx.supabase
      .from("habit_tasks")
      .select("tasks!inner(id, status, due_date, completed_at)")
      .eq("habit_id", habit_id);

    const tasks = (linked ?? []).map(
      (l) => l.tasks as unknown as Pick<Task, "id" | "status" | "due_date" | "completed_at">
    );
    const anyPendingDue = tasks.some(
      (t) => t.status === "pending" && t.due_date <= today
    );
    const anyYesToday = tasks.some(
      (t) => t.status === "yes" && t.completed_at?.startsWith(today)
    );

    if (!anyPendingDue && anyYesToday) {
      await ctx.supabase.from("habit_logs").upsert(
        {
          habit_id,
          user_id: ctx.user.id,
          log_date: today,
          status: "completed" as const,
        },
        { onConflict: "habit_id,log_date" }
      );
    } else {
      await ctx.supabase
        .from("habit_logs")
        .delete()
        .eq("habit_id", habit_id)
        .eq("log_date", today)
        .eq("status", "completed");
    }
  }
}
