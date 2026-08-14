import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type AuthContext = {
  supabase: SupabaseClient;
  user: User;
};

/**
 * Every protected endpoint calls this first. Validates the session token
 * against Supabase Auth (`getUser()` verifies the JWT server-side); if there
 * is no valid, active token the request is rejected with 401 and nothing
 * else runs.
 */
export async function requireUser(): Promise<AuthContext | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { supabase, user };
}

export function isUnauthorized(
  ctx: AuthContext | NextResponse
): ctx is NextResponse {
  return ctx instanceof NextResponse;
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
