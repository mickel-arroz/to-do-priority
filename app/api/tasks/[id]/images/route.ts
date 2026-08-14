import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError("missing_file", 400);
  if (!ALLOWED.includes(file.type)) return jsonError("invalid_file_type", 400);
  if (file.size > MAX_SIZE) return jsonError("file_too_large", 413);

  const { count } = await ctx.supabase
    .from("task_images")
    .select("*", { count: "exact", head: true })
    .eq("task_id", id);
  if ((count ?? 0) >= 3) return jsonError("max_task_images", 409);

  const ext = file.type.split("/")[1];
  const storagePath = `${ctx.user.id}/${id}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await ctx.supabase.storage
    .from("task-images")
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) return jsonError(uploadError.message, 500);

  const { data, error } = await ctx.supabase
    .from("task_images")
    .insert({
      task_id: id,
      user_id: ctx.user.id,
      storage_path: storagePath,
      position: count ?? 0,
    })
    .select()
    .single();

  if (error) {
    await ctx.supabase.storage.from("task-images").remove([storagePath]);
    if (error.message.includes("max_task_images")) {
      return jsonError("max_task_images", 409);
    }
    return jsonError(error.message, 500);
  }

  const { data: signed } = await ctx.supabase.storage
    .from("task-images")
    .createSignedUrl(storagePath, 3600);

  return NextResponse.json(
    { image: { ...data, signed_url: signed?.signedUrl } },
    { status: 201 }
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;
  const imageId = new URL(request.url).searchParams.get("imageId");
  if (!imageId) return jsonError("missing_image_id", 400);

  const { data: image } = await ctx.supabase
    .from("task_images")
    .select("storage_path")
    .eq("id", imageId)
    .eq("task_id", id)
    .single();
  if (!image) return jsonError("not_found", 404);

  await ctx.supabase.storage.from("task-images").remove([image.storage_path]);
  const { error } = await ctx.supabase
    .from("task_images")
    .delete()
    .eq("id", imageId);

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
