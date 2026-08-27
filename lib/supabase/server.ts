import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component: session refresh is handled by proxy.ts
          }
        },
      },
    }
  );
}

/**
 * Cliente para el trabajo que corre en `after()`, con la respuesta ya enviada.
 *
 * Lee las cookies una sola vez, durante el render, y se queda con esa foto: un
 * Server Component no puede tocar el store de la petición dentro del callback
 * de `after()`. Escribir tampoco tendría sentido —la respuesta ya salió—, así
 * que un refresco de sesión se usa en memoria y no se persiste; de eso ya se
 * encarga proxy.ts en la siguiente petición.
 */
export async function createDeferredClient() {
  const cookieStore = await cookies();
  const snapshot = cookieStore
    .getAll()
    .map(({ name, value }) => ({ name, value }));

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => snapshot,
        setAll: () => {},
      },
    }
  );
}
