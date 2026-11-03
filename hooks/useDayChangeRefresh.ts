"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TZ_COOKIE } from "@/lib/timezone";

/**
 * Margen tras la medianoche: si el reloj del equipo va unos segundos adelantado
 * respecto al servidor, el refresco no llega cuando allí aún es ayer.
 */
const MIDNIGHT_GRACE_MS = 5_000;

/** Clave del día local del equipo; sólo se compara, no es una fecha ISO. */
function localDayKey(now: Date) {
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

function msUntilNextMidnight(now: Date) {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime() + MIDNIGHT_GRACE_MS;
}

/**
 * El script del layout raíz sólo escribe la cookie `tz` en una carga completa;
 * si la zona del equipo cambió con la pestaña abierta, el servidor la
 * necesita al día antes del refresco.
 */
function syncTimeZoneCookie() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      document.cookie = `${TZ_COOKIE}=${tz};path=/;max-age=31536000;samesite=lax`;
    }
  } catch {}
}

/**
 * Refresca la ruta cuando cambia el Día del usuario con la app abierta: a la
 * medianoche local o, si el equipo estuvo suspendido y el temporizador no
 * llegó a dispararse, al volver a la pestaña. El reloj del navegador sólo
 * detecta el cambio; qué día es lo sigue decidiendo el servidor (ADR 0003),
 * y el refresco vuelve a pasar por el layout, que arranca la Generación
 * diaria del día nuevo.
 */
export function useDayChangeRefresh() {
  const router = useRouter();

  useEffect(() => {
    let day = localDayKey(new Date());
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = () => {
      const now = new Date();
      const current = localDayKey(now);
      if (current !== day) {
        day = current;
        syncTimeZoneCookie();
        router.refresh();
      }
      // Reprogramar siempre: un temporizador que se adelanta un poco vuelve a
      // apuntar a la misma medianoche en vez de perderla.
      clearTimeout(timer);
      timer = setTimeout(check, msUntilNextMidnight(now));
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };

    timer = setTimeout(check, msUntilNextMidnight(new Date()));
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);
}
