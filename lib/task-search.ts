import Fuse, { type IFuseOptions } from "fuse.js";
import type { Task } from "@/lib/types";

/** Por debajo de esto la búsqueda no arranca: con una letra casi todo coincide. */
export const MIN_QUERY_LENGTH = 2;
/** Lo que cabe en el modal sin que deje de ser manejable. */
export const MAX_RESULTS = 20;

/**
 * Tolerancia a erratas (0 exige coincidencia exacta, 1 acepta cualquier cosa).
 * `ignoreLocation` porque la coincidencia vale igual al principio que al final
 * de una descripción larga.
 */
const FUZZY: IFuseOptions<Task> = {
  ignoreDiacritics: true,
  ignoreLocation: true,
  includeScore: true,
  threshold: 0.4,
};

/**
 * Los grupos estrictos del orden, del que más pesa al que menos: una tarea va
 * en el primero donde coincide y dentro de cada grupo se ordena por parecido.
 */
const GROUPS = [
  ["title"],
  ["description"],
  ["subtasks", "title"],
] as const;

/**
 * Las tareas que se parecen al texto, como mucho `MAX_RESULTS`: primero las que
 * coinciden por título, luego las que sólo coinciden por descripción y al
 * final las que sólo coinciden por alguna subtarea. Ignora acentos y
 * mayúsculas y tolera erratas. Con menos de `MIN_QUERY_LENGTH` caracteres
 * devuelve vacío.
 */
export function searchTasks(tasks: Task[], query: string): Task[] {
  const text = query.trim();
  if (text.length < MIN_QUERY_LENGTH) return [];

  const seen = new Set<string>();
  const results: Task[] = [];
  for (const key of GROUPS) {
    const hits = new Fuse(tasks, { ...FUZZY, keys: [[...key]] }).search(text);
    for (const { item } of hits) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      results.push(item);
      if (results.length === MAX_RESULTS) return results;
    }
  }
  return results;
}
