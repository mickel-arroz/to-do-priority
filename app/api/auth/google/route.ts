import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/app/api/_lib/auth";
import { getSiteOrigin } from "@/lib/site-url";

export async function POST(request: Request) {
  const origin = getSiteOrigin(request);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) return jsonError("oauth_failed", 500);

  return NextResponse.json({ url: data.url });
}
