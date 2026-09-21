import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/limits";

/**
 * Los topes viven dos veces: en `lib/limits.ts` y como constraints en
 * `0008_text_length_checks.sql`. La duplicación es deliberada (la base no
 * debe fiarse de que la API sea el único camino de escritura), pero solo
 * sirve mientras los dos digan lo mismo. Esto lee el SQL y los compara.
 */

const sqlPath = (name: string) =>
  join(process.cwd(), "supabase", "migrations", name);

/** Solo las sentencias: los comentarios explican, no ejecutan. */
const statements = (name: string) =>
  readFileSync(sqlPath(name), "utf8").replace(/--.*$/gm, "");

const addSql = statements("0008_text_length_checks.sql");
const validateSql = statements("0009_validate_text_length_checks.sql");

/** Cada columna con tope y la clave de LIMITS de la que sale. */
const EXPECTED: Record<string, keyof typeof LIMITS> = {
  categories_name_length_check: "categoryName",
  tasks_title_length_check: "taskTitle",
  tasks_description_length_check: "taskDescription",
  subtasks_title_length_check: "subtaskTitle",
  habits_name_length_check: "habitName",
  habits_description_length_check: "habitDescription",
  // Copia del título de la tarea: hereda su tope.
  task_completions_title_snapshot_length_check: "taskTitle",
};

/** `add constraint <nombre> check (... <= 123)` -> { nombre: 123 } */
function parseConstraints(sql: string): Record<string, number> {
  const found: Record<string, number> = {};
  const re = /add constraint (\w+)\s+check \([^)]*\)?[^;]*?<= (\d+)\)/g;
  for (const [, name, max] of sql.matchAll(re)) found[name] = Number(max);
  return found;
}

describe("constraints de longitud en la base de datos", () => {
  const constraints = parseConstraints(addSql);

  it("declara una constraint por cada tope de texto de LIMITS", () => {
    const covered = new Set(Object.values(EXPECTED));
    for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
      expect(covered, `LIMITS.${key} no tiene constraint en la base`).toContain(
        key
      );
    }
  });

  it("no declara constraints que no salgan de LIMITS", () => {
    expect(Object.keys(constraints).sort()).toEqual(
      Object.keys(EXPECTED).sort()
    );
  });

  it.each(Object.entries(EXPECTED))(
    "%s usa el mismo número que LIMITS",
    (name, key) => {
      expect(constraints[name]).toBe(LIMITS[key]);
    }
  );

  it("añade todas las constraints como `not valid`, sin tocar filas viejas", () => {
    const notValid = addSql.match(/not valid/g) ?? [];
    expect(notValid).toHaveLength(Object.keys(EXPECTED).length);
  });

  it("no contiene ninguna sentencia destructiva", () => {
    expect(addSql).not.toMatch(/\b(drop|delete|truncate|update)\b/i);
    expect(validateSql).not.toMatch(/\b(drop|delete|truncate|update)\b/i);
  });

  it("valida en 0009 exactamente las constraints que 0008 crea", () => {
    const validated = [...validateSql.matchAll(/validate constraint (\w+);/g)]
      .map(([, name]) => name)
      .sort();
    expect(validated).toEqual(Object.keys(EXPECTED).sort());
  });
});
