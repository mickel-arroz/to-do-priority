import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/error-message";
import { getDictionary } from "@/lib/i18n";
import { LIMITS } from "@/lib/limits";

const t = getDictionary("es");

const apiError = (body: Record<string, unknown>) =>
  new ApiError(400, String(body.error), body);

describe("apiErrorMessage", () => {
  it("traduce el tope de subtareas que rechaza el servidor", () => {
    // El `POST` de subtareas lo devuelve cuando la tarea ya está llena, y sin
    // este mapeo el usuario vería el error genérico.
    expect(apiErrorMessage(apiError({ error: "subtask_limit_reached" }), t)).toBe(
      t.tasks.subtaskLimitReached
    );
  });

  it("nombra el campo y el máximo en un desbordamiento de longitud", () => {
    const err = apiError({
      error: "too_long",
      field: "subtask",
      max: LIMITS.subtaskTitle,
    });
    const message = apiErrorMessage(err, t);

    expect(message).toContain(t.tasks.subtasks);
    expect(message).toContain(String(LIMITS.subtaskTitle));
  });

  it("cae al mensaje genérico con un código que no conoce", () => {
    expect(apiErrorMessage(apiError({ error: "boom" }), t)).toBe(t.common.error);
  });

  it("cae al mensaje genérico con algo que no es un error de la API", () => {
    expect(apiErrorMessage(new Error("red caida"), t)).toBe(t.common.error);
  });
});
