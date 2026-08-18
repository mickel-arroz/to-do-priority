import { NextResponse } from "next/server";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";
import { habitSchema, validationErrorResponse } from "@/app/api/_lib/schemas";

export async function GET() {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const [{ data: habits, error }, { data: logs, error: logsError }] =
    await Promise.all([
      ctx.supabase
        .from("habits")
        .select("*, habit_tasks(task_id)")
        .order("created_at"),
      ctx.supabase.from("habit_logs").select("*"),
    ]);

  if (error) return jsonError(error.message, 500);
  if (logsError) return jsonError(logsError.message, 500);
  return NextResponse.json({ habits, logs });
}

export async function POST(request: Request) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const body = await request.json().catch(() => null);
  const parsed = habitSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { task_ids, ...habitInput } = parsed.data;

  const { data: habit, error } = await ctx.supabase
    .from("habits")
    .insert({ ...habitInput, user_id: ctx.user.id })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);

  const { error: linkError } = await ctx.supabase.from("habit_tasks").insert(
    task_ids.map((task_id) => ({
      habit_id: habit.id,
      task_id,
      user_id: ctx.user.id,
    }))
  );
  if (linkError) {
    await ctx.supabase.from("habits").delete().eq("id", habit.id);
    return jsonError(linkError.message, 500);
  }

  return NextResponse.json({ habit }, { status: 201 });
}
