"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/** En el servidor no hay puntero que medir; se asume el caso de escritorio. */
function getServerSnapshot() {
  return false;
}

/**
 * `true` en dispositivos de puntero grueso —móvil y tablet—, que son los que
 * levantan un teclado virtual al enfocar un input.
 *
 * Se mide el puntero y no el ancho a propósito: un escritorio con la ventana
 * estrecha sigue teniendo teclado físico y agradece el foco automático, que es
 * justo lo que el ancho no distingue.
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
