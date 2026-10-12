"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * `true` mientras el media query se cumpla. Se reevalúa cuando cambia (p. ej. al
 * redimensionar la ventana), no sólo al montar. En el servidor no hay viewport
 * que medir, así que devuelve `false`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
