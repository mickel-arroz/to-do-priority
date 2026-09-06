/**
 * Origen público de la app: el que ve el navegador del usuario.
 *
 * `new URL(request.url).origin` es el origen con el que el *runtime* recibió la
 * petición. Detrás del proxy de un hosting (Vercel, Docker, Nginx) eso puede no
 * ser el dominio real, y cualquier `redirectTo` construido con él manda al
 * usuario a una URL equivocada al volver de Supabase —el clásico "después de
 * iniciar sesión acabo en localhost:3000".
 *
 * Orden de preferencia:
 *  1. `NEXT_PUBLIC_SITE_URL`, override explícito. Ojo: si la defines para todos
 *     los entornos, los deploys de preview también redirigirán a producción.
 *  2. `x-forwarded-host` / `x-forwarded-proto`, el host real tras el proxy.
 *  3. El origen de la petición (caso normal en `next dev`).
 */
export function getSiteOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return normalizeOrigin(configured);

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    // Un encadenamiento de proxies deja una lista: el primero es el original
    const host = forwardedHost.split(",")[0]!.trim();
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
      "https";
    if (host) return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

function normalizeOrigin(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).origin;
}

/**
 * Solo aceptamos rutas internas como destino post-login: un `next` absoluto
 * (`https://otro-sitio.com`) convertiría el callback en un open redirect.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
