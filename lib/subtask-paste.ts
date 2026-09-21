import { LIMITS } from "@/lib/limits";

/**
 * Los marcadores que abren un elemento de lista al copiar de un editor, una
 * nota o un chat: guion, asterisco, más, las viñetas unicode más comunes y la
 * numeración (`1.`, `2)`, `3-`).
 *
 * El espacio detrás es obligatorio, y es lo único que distingue una lista de
 * un texto normal: `- Uno` es un elemento, pero `-> Revisar`, `*negrita*` y
 * `-5 grados` no lo son y entran tal cual. La alternativa —aceptar el
 * marcador pegado al texto— se comería caracteres de subtareas legítimas.
 */
const LIST_MARKER = /^(?:[-*+•◦▪▫‣·–—]|\d{1,9}[.)\-])(?:\s+|$)/;

/** La casilla de markdown, que va detrás del marcador: `- [ ]`, `- [x]`. */
const CHECKBOX = /^\[[ xX]\](?:\s+|$)/;

/** Cualquier final de línea, incluida la línea blanda (`\v`) de Word y Excel. */
const LINE_BREAK = /\r\n?|[\n\v]/;

/**
 * Convierte un texto pegado en la lista de subtareas que representa: una por
 * línea con contenido, sin su marcador de lista y recortada al tope de
 * caracteres. Las líneas vacías —y las que solo traen el marcador— se caen.
 *
 * Truncar en vez de rechazar es deliberado: una línea larga sigue siendo un
 * paso que el usuario quiso crear, y así el formulario nunca queda en un
 * estado que no se pueda guardar.
 *
 * No aplica el tope de *cuántas* subtareas caben: eso depende de las que ya
 * haya en el formulario, algo que solo conoce quien llama.
 */
export function parsePastedSubtasks(text: string): string[] {
  const titles: string[] = [];

  for (const line of text.split(LINE_BREAK)) {
    const body = line.trim().replace(LIST_MARKER, "").replace(CHECKBOX, "");
    const title = body.trim().slice(0, LIMITS.subtaskTitle).trim();
    if (title) titles.push(title);
  }

  return titles;
}
