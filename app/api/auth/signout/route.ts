import { NextResponse } from "next/server";
import { isUnauthorized, requireUser } from "@/app/api/_lib/auth";

export async function POST() {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  await ctx.supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
