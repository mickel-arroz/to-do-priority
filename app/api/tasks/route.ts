import { NextResponse } from "next/server";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";
import { taskSchema } from "@/app/api/_lib/schemas";

export async function GET(request: Request) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const categoryId = new URL(request.url).searchParams.get("categoryId");

  let query = ctx.supabase
    .from("tasks")
    .select("*, subtasks(*), task_images(*)")
    .eq("status", "pending")
    .order("due_date")
    .order("priority");

  if (categoryId) query = query.eq("category_id", categoryId);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ tasks: data });
}

export async function POST(request: Request) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const body = await request.json().catch(() => null);
  const parsed = taskSchema.safeParse(body);
  if (!parsed.success) return jsonError("invalid_payload", 400);

  const { subtasks, ...taskInput } = parsed.data;

  const { data: task, error } = await ctx.supabase
    .from("tasks")
    .insert({ ...taskInput, user_id: ctx.user.id })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);

  if (subtasks && subtasks.length > 0) {
    const { error: subError } = await ctx.supabase.from("subtasks").insert(
      subtasks.map((s, i) => ({
        task_id: task.id,
        user_id: ctx.user.id,
        title: s.title,
        position: i,
      }))
    );
    if (subError) return jsonError(subError.message, 500);
  }

  const { data: full } = await ctx.supabase
    .from("tasks")
    .select("*, subtasks(*), task_images(*)")
    .eq("id", task.id)
    .single();

  return NextResponse.json({ task: full ?? task }, { status: 201 });
}
