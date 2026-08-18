import { cookies, headers } from "next/headers";
import { getDayOfYear, parseISO } from "date-fns";
import { resolveTimeZone, TZ_COOKIE } from "@/lib/timezone";

/**
 * "Hoy" resuelto 100% en el servidor, en la zona horaria del usuario.
 *
 * Cascada de señales (de más a menos fiable):
 *   1. Cookie `tz` → reloj real del dispositivo (autoritativo y dinámico; la
 *      escribe un script pre-hidratación en el layout raíz).
 *   2. `x-vercel-ip-timezone` → geolocalización por IP de Vercel, cubre el
 *      primerísimo request antes de que exista la cookie.
 *   3. Fallback interno de `resolveTimeZone` → zona de la máquina.
 *
 * Al derivarse antes de las queries, todo lo que depende de "hoy" (vencidas,
 * ventana de completadas, rachas) queda consistente con la hora local.
 */
export async function getUserToday() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);

  const timeZone = resolveTimeZone(
    cookieStore.get(TZ_COOKIE)?.value,
    headerStore.get("x-vercel-ip-timezone")
  );

  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // en-CA ⇒ yyyy-MM-dd

  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23", // 00–23; evita el "24" de medianoche de algunos motores
    }).format(now)
  );

  return { today, hour, dayOfYear: getDayOfYear(parseISO(today)), timeZone };
}
