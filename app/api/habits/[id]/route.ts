import { NextResponse } from "next/server";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";
import { habitUpdateSchema, validationErrorResponse } from "@/app/api/_lib/schemas";

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

  const { data: habit, error } = await ctx.supabase
    .from("habits")
    .update(habitInput)
    .eq("id", id)
    .select()
    .single();

  if (error) return jsonError(error.message, 500);

  if (task_ids) {
    await ctx.supabase.from("habit_tasks").delete().eq("habit_id", id);
    const { error: linkError } = await ctx.supabase.from("habit_tasks").insert(
      task_ids.map((task_id) => ({
        habit_id: id,
        task_id,
        user_id: ctx.user.id,
      }))
    );
    if (linkError) return jsonError(linkError.message, 500);
  }

  return NextResponse.json({ habit });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;
  const { error } = await ctx.supabase.from("habits").delete().eq("id", id);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
