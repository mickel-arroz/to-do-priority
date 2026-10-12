"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * `true` en dispositivos de puntero grueso —móvil y tablet—, que son los que
 * levantan un teclado virtual al enfocar un input. En el servidor no hay
 * puntero que medir; se asume el caso de escritorio.
 *
 * Se mide el puntero y no el ancho a propósito: un escritorio con la ventana
 * estrecha sigue teniendo teclado físico y agradece el foco automático, que es
 * justo lo que el ancho no distingue.
 */
export function useCoarsePointer(): boolean {
  return useMediaQuery("(pointer: coarse)");
}
