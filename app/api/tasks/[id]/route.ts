import { NextResponse } from "next/server";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";
import {
  linkedHabitIds,
  syncHabitDays,
  syncHabitDaysForTask,
} from "@/app/api/_lib/habit-day";
import { taskSchema, validationErrorResponse } from "@/app/api/_lib/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = taskSchema.partial().safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const taskInput = { ...parsed.data };
  delete taskInput.subtasks;

  // Mover el vencimiento cambia qué vence en dos días del hábito: el que la
  // tarea abandona y el que estrena. Hay que saber el viejo antes de escribir.
  // El estado no entra por aquí (`taskSchema` no lo admite): eso lo hacen las
  // rutas de completar y de cambiar estado, que ya sincronizan.
  let previousDueDate: string | null = null;
  if (taskInput.due_date) {
    const { data: current } = await ctx.supabase
      .from("tasks")
      .select("due_date")
      .eq("id", id)
      .single();
    previousDueDate = (current?.due_date as string | undefined) ?? null;
  }

  const { data, error } = await ctx.supabase
    .from("tasks")
    .update(taskInput)
    .eq("id", id)
    .select("*, subtasks(*), task_images(*)")
    .single();

  if (error) return jsonError(error.message, 500);

  if (
    taskInput.due_date &&
    previousDueDate &&
    previousDueDate !== taskInput.due_date
  ) {
    await syncHabitDaysForTask(ctx, id, [previousDueDate, taskInput.due_date]);
  }

  return NextResponse.json({ task: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;

  // El borrado se lleva el vínculo con el hábito por cascada, así que los
  // hábitos y el día a recalcular hay que capturarlos antes de borrar.
  const [habitIds, { data: task }] = await Promise.all([
    linkedHabitIds(ctx, id),
    ctx.supabase.from("tasks").select("due_date").eq("id", id).maybeSingle(),
  ]);

  // Remove storage objects first: Postgres cascade won't touch the bucket
  const { data: images } = await ctx.supabase
    .from("task_images")
    .select("storage_path")
    .eq("task_id", id);
  const paths = (images ?? []).map((i) => i.storage_path);
  if (paths.length > 0) {
    await ctx.supabase.storage.from("task-images").remove(paths);
  }

  const { error } = await ctx.supabase.from("tasks").delete().eq("id", id);
  if (error) return jsonError(error.message, 500);

  if (habitIds.length > 0 && task?.due_date) {
    await syncHabitDays(ctx, habitIds, [task.due_date as string]);
  }
  return NextResponse.json({ ok: true });
}
