import { NextResponse } from "next/server";
import { z } from "zod";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";

const createSchema = z.object({ title: z.string().trim().min(1).max(200) });
const toggleSchema = z.object({
  subtaskId: z.string().uuid(),
  is_done: z.boolean(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("invalid_payload", 400);

  const { count } = await ctx.supabase
    .from("subtasks")
    .select("*", { count: "exact", head: true })
    .eq("task_id", id);

  const { data, error } = await ctx.supabase
    .from("subtasks")
    .insert({
      task_id: id,
      user_id: ctx.user.id,
      title: parsed.data.title,
      position: count ?? 0,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ subtask: data }, { status: 201 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) return jsonError("invalid_payload", 400);

  const { data, error } = await ctx.supabase
    .from("subtasks")
    .update({ is_done: parsed.data.is_done })
    .eq("id", parsed.data.subtaskId)
    .eq("task_id", id)
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ subtask: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;
  const subtaskId = new URL(request.url).searchParams.get("subtaskId");
  if (!subtaskId) return jsonError("missing_subtask_id", 400);

  const { error } = await ctx.supabase
    .from("subtasks")
    .delete()
    .eq("id", subtaskId)
    .eq("task_id", id);

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
