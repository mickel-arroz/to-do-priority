import { NextResponse } from "next/server";
import { z } from "zod";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";
import { validationErrorResponse } from "@/app/api/_lib/schemas";
import { LIMITS } from "@/lib/limits";

const renameSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.categoryName).optional(),
  icon: z.string().max(30).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullish(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { data, error } = await ctx.supabase
    .from("categories")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return jsonError("name_taken", 409);
    return jsonError(error.message, 500);
  }
  return NextResponse.json({ category: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;
  const strategy = new URL(request.url).searchParams.get("strategy");
  if (strategy !== "move" && strategy !== "delete") {
    return jsonError("invalid_strategy", 400);
  }

  // Storage files of tasks that will be deleted must go too (Postgres
  // can't remove storage objects)
  if (strategy === "delete") {
    const { data: images } = await ctx.supabase
      .from("task_images")
      .select("storage_path, tasks!inner(category_id)")
      .eq("tasks.category_id", id);
    const paths = (images ?? []).map((i) => i.storage_path);
    if (paths.length > 0) {
      await ctx.supabase.storage.from("task-images").remove(paths);
    }
  }

  const { error } = await ctx.supabase.rpc("delete_category_with_tasks", {
    p_category_id: id,
    p_move_to_general: strategy === "move",
  });

  if (error) {
    if (error.message.includes("default_category_protected")) {
      return jsonError("default_category_protected", 403);
    }
    return jsonError(error.message, 500);
  }
  return NextResponse.json({ ok: true });
}
