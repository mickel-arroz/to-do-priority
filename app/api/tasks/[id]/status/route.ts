import { NextResponse } from "next/server";
import { z } from "zod";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";
import { syncHabitDaysForTask } from "@/app/api/_lib/habit-day";
import { getUserToday } from "@/lib/server-today";
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

  const { today } = await getUserToday();

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
    await syncHabitDaysForTask(ctx, id, today);
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
  // Pasar una tarea a 'no' revierte el día: deja de contar como día objetivo,
  // sin restar ninguno de los ya ganados.
  await syncHabitDaysForTask(ctx, id, today);
  return NextResponse.json({ task: updated });
}
