// @vitest-environment node
import { describe, expect, it } from "vitest";
import { taskSchema, validationErrorResponse } from "@/app/api/_lib/schemas";
import { LIMITS } from "@/lib/limits";

const base = {
  title: "Regar",
  category_id: "11111111-1111-4111-8111-111111111111",
  due_date: "2026-10-12",
  priority: 1,
};

/** El cuerpo que devuelve la API al rechazar esta tarea. */
async function rejection(input: Record<string, unknown>) {
  const parsed = taskSchema.safeParse({ ...base, ...input });
  if (parsed.success) throw new Error("la tarea debía rechazarse");
  const res = validationErrorResponse(parsed.error);
  expect(res.status).toBe(400);
  return res.json();
}

describe("validationErrorResponse", () => {
  it("un texto largo es too_long con su campo y su tope", async () => {
    expect(await rejection({ title: "x".repeat(LIMITS.taskTitle + 1) })).toEqual({
      error: "too_long",
      field: "title",
      max: LIMITS.taskTitle,
    });
  });

  it("una lista con demasiados elementos es too_many", async () => {
    const subtasks = Array.from({ length: LIMITS.subtasksPerTask + 1 }, () => ({
      title: "Paso",
    }));
    expect(await rejection({ subtasks })).toEqual({
      error: "too_many",
      field: "subtasks",
      max: LIMITS.subtasksPerTask,
    });
  });

  it("un número por encima de su máximo es too_large, no un tope de caracteres", async () => {
    expect(await rejection({ pomodoro_minutes: 181 })).toEqual({
      error: "too_large",
      field: "pomodoro_minutes",
      max: 180,
    });
  });
});
