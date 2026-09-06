import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin, safeNextPath } from "@/lib/site-url";

/**
 * Aterrizaje del flujo PKCE: Supabase (o el proveedor OAuth) devuelve aquí con
 * `?code=`, lo canjeamos por sesión y seguimos al destino. Cualquier fallo
 * vuelve a /login con un `?error=` que la pantalla sabe traducir.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getSiteOrigin(request);
  const next = safeNextPath(url.searchParams.get("next"));

  const loginWith = (error: string) =>
    NextResponse.redirect(new URL(`/login?error=${error}`, origin));

  // El proveedor puede rebotar con error antes de emitir código
  // (consentimiento cancelado, cuenta bloqueada, etc.)
  if (url.searchParams.get("error")) return loginWith("oauth");

  const code = url.searchParams.get("code");
  if (!code) return loginWith("missing_code");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return loginWith("exchange");

  return NextResponse.redirect(new URL(next, origin));
}
