import { NextResponse } from "next/server";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";
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

  const { data, error } = await ctx.supabase
    .from("tasks")
    .update(taskInput)
    .eq("id", id)
    .select("*, subtasks(*), task_images(*)")
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ task: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;

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
  return NextResponse.json({ ok: true });
}
