import { NextResponse } from "next/server";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";
import { taskSchema, validationErrorResponse } from "@/app/api/_lib/schemas";

export async function GET(request: Request) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const params = new URL(request.url).searchParams;
  const categoryId = params.get("categoryId");
  const q = params.get("q")?.trim();
  const rawLimit = Number(params.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(100, Math.floor(rawLimit))
      : null;
  const offset = Math.max(0, Math.floor(Number(params.get("offset")) || 0));

  let query = ctx.supabase
    .from("tasks")
    .select("*, subtasks(*), task_images(*)")
    .eq("status", "pending")
    .order("due_date")
    .order("priority");

  if (categoryId) query = query.eq("category_id", categoryId);
  if (q) query = query.ilike("title", `%${q}%`);
  // Fetch one extra row to know whether there is a next page
  if (limit !== null) query = query.range(offset, offset + limit);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);

  let tasks = data ?? [];
  let hasMore = false;
  if (limit !== null && tasks.length > limit) {
    hasMore = true;
    tasks = tasks.slice(0, limit);
  }
  return NextResponse.json({ tasks, hasMore });
}

export async function POST(request: Request) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const body = await request.json().catch(() => null);
  const parsed = taskSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

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
