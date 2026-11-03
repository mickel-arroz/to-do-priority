import { NextResponse } from "next/server";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";
import { notifyChange } from "@/app/api/_lib/live-sync";
import { dueDatesOf, syncHabitDays } from "@/app/api/_lib/habit-day";
import { habitUpdateSchema, validationErrorResponse } from "@/app/api/_lib/schemas";
import type { TaskStatus } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;
  const { data: habit, error } = await ctx.supabase
    .from("habits")
    .select("*, habit_tasks(task_id)")
    .eq("id", id)
    .single();

  if (error || !habit) return jsonError("not_found", 404);

  const taskIds = (habit.habit_tasks ?? []).map(
    (ht: { task_id: string }) => ht.task_id
  );

  const [{ data: logs }, { data: tasks }] = await Promise.all([
    ctx.supabase.from("habit_logs").select("*").eq("habit_id", id),
    taskIds.length > 0
      ? ctx.supabase.from("tasks").select("*").in("id", taskIds)
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({ habit, logs: logs ?? [], tasks: tasks ?? [] });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = habitUpdateSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { task_ids, ...habitInput } = parsed.data;

  // `task_ids` son las tareas pendientes que el hábito quiere vinculadas. Las
  // ya cerradas siguen vinculadas pase lo que pase: son el historial del que
  // el calendario deriva los días (ADR 0005, 0009), y cada instancia cerrada
  // de una recurrente suma una, así que el cliente no las manda. Los días a
  // recalcular son los de las que salen y los de las que entran, y hay que
  // saber cuáles son antes de romper el conjunto viejo.
  let removed: string[] = [];
  let added: string[] = [];
  if (task_ids) {
    const { data: previous } = await ctx.supabase
      .from("habit_tasks")
      .select("task_id, tasks!inner(status)")
      .eq("habit_id", id);
    const links = (previous ?? []) as unknown as {
      task_id: string;
      tasks: { status: TaskStatus } | null;
    }[];
    const before = new Set(links.map((l) => l.task_id));
    const after = new Set([
      ...task_ids,
      ...links.filter((l) => l.tasks?.status !== "pending").map((l) => l.task_id),
    ]);
    if (after.size === 0) return jsonError("invalid_payload", 400);
    removed = [...before].filter((t) => !after.has(t));
    added = [...after].filter((t) => !before.has(t));
  }

  const { data: habit, error } = await ctx.supabase
    .from("habits")
    .update(habitInput)
    .eq("id", id)
    .select()
    .single();

  if (error) return jsonError(error.message, 500);

  if (removed.length > 0) {
    await ctx.supabase
      .from("habit_tasks")
      .delete()
      .eq("habit_id", id)
      .in("task_id", removed);
  }
  if (added.length > 0) {
    const { error: linkError } = await ctx.supabase.from("habit_tasks").insert(
      added.map((task_id) => ({
        habit_id: id,
        task_id,
        user_id: ctx.user.id,
      }))
    );
    if (linkError) return jsonError(linkError.message, 500);
  }

  const changed = [...removed, ...added];
  if (changed.length > 0) {
    await syncHabitDays(ctx, [id], await dueDatesOf(ctx, changed));
  }

  await notifyChange(ctx, request);
  return NextResponse.json({ habit });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;
  const { error } = await ctx.supabase.from("habits").delete().eq("id", id);
  if (error) return jsonError(error.message, 500);
  await notifyChange(ctx, request);
  return NextResponse.json({ ok: true });
}
