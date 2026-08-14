import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/app/api/_lib/auth";

const registerSchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid registration payload", 400);

  const { fullName, email, password } = parsed.data;
  const origin = new URL(request.url).origin;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) return jsonError("registration_failed", 400);

  return NextResponse.json({
    user: data.user ? { id: data.user.id, email: data.user.email } : null,
    needsEmailConfirmation: !data.session,
  });
}
