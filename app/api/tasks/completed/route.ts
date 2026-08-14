import { NextResponse } from "next/server";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";

/**
 * Last 30 completed tasks, newest completion first (ties broken by
 * priority). With ?categoryId= it returns only that list's completions;
 * without it (Home) each task carries its list so the UI can show where
 * it belongs.
 */
export async function GET(request: Request) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const categoryId = new URL(request.url).searchParams.get("categoryId");

  let query = ctx.supabase
    .from("tasks")
    .select("*, categories(id, name, color, icon, is_default)")
    .in("status", ["yes", "no"])
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .order("priority")
    .limit(30);

  if (categoryId) query = query.eq("category_id", categoryId);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ tasks: data });
}
