import { NextResponse } from "next/server";
import { z } from "zod";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";
import { validationErrorResponse } from "@/app/api/_lib/schemas";
import { LIMITS } from "@/lib/limits";

export async function GET() {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { data, error } = await ctx.supabase
    .from("categories")
    .select("*")
    .order("is_default", { ascending: false })
    .order("position")
    .order("name");

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ categories: data });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.categoryName),
  icon: z.string().max(30).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullish(),
});

export async function POST(request: Request) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { data, error } = await ctx.supabase
    .from("categories")
    .insert({ user_id: ctx.user.id, ...parsed.data })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return jsonError("name_taken", 409);
    return jsonError(error.message, 500);
  }
  return NextResponse.json({ category: data }, { status: 201 });
}
