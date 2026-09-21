import { describe, expect, it } from "vitest";
import { subtaskTitleSchema, taskSchema } from "@/app/api/_lib/schemas";
import { LIMITS } from "@/lib/limits";

const MAX = LIMITS.subtaskTitle;

const task = {
  title: "Regar las plantas",
  category_id: "11111111-1111-4111-8111-111111111111",
  due_date: "2026-08-14",
  priority: 4,
};

describe("LIMITS.subtaskTitle", () => {
  // El único sitio donde el tope se escribe a mano: fija el valor canónico
  // para que subirlo o bajarlo sea una decisión y no un descuido.
  it("vale 200 caracteres", () => {
    expect(MAX).toBe(200);
  });
});

describe("subtaskTitleSchema", () => {
  it("acepta un título en el tope", () => {
    expect(subtaskTitleSchema.safeParse("a".repeat(MAX)).success).toBe(true);
  });

  it("rechaza un título que pasa el tope por un carácter", () => {
    expect(subtaskTitleSchema.safeParse("a".repeat(MAX + 1)).success).toBe(
      false
    );
  });
});

describe("taskSchema: subtareas", () => {
  it("acepta una subtarea en el tope", () => {
    const parsed = taskSchema.safeParse({
      ...task,
      subtasks: [{ title: "a".repeat(MAX) }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza una subtarea que pasa el tope por un carácter", () => {
    const parsed = taskSchema.safeParse({
      ...task,
      subtasks: [{ title: "a".repeat(MAX + 1) }],
    });
    expect(parsed.success).toBe(false);
  });
});
