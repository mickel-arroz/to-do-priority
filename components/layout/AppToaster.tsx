"use client";

import { POMODORO_CLEARANCE_VAR } from "@/components/pomodoro/PomodoroWidget";
import { Toaster } from "@/components/ui/sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/** El breakpoint `md` de Tailwind, el mismo que separa el layout de escritorio. */
const DESKTOP_QUERY = "(min-width: 48rem)";

/**
 * Altura que ocupa el widget del pomodoro desde el borde inferior; la publica
 * el propio widget mientras está visible (ver PomodoroWidget). Sin widget vale
 * 0 y los toasts quedan a la distancia por defecto de sonner.
 */
const DESKTOP_OFFSET = {
  bottom: `calc(24px + var(${POMODORO_CLEARANCE_VAR}, 0px))`,
};

/**
 * Toaster único de la app. En escritorio los toasts salen abajo a la derecha,
 * por encima del widget del pomodoro; en móvil, arriba al centro. Sigue al
 * media query, así que cambia al cruzar el breakpoint sin recargar.
 */
export function AppToaster() {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  return (
    <Toaster
      position={isDesktop ? "bottom-right" : "top-center"}
      offset={isDesktop ? DESKTOP_OFFSET : undefined}
      richColors
    />
  );
}
