import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();

vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return {
    ...actual,
    GoogleGenAI: class {
      models = { generateContent };
    },
  };
});

import { createGeminiProvider } from "@/lib/ai/gemini";

const CASCADE = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemma-4-31b-it",
];

/** `maxDuration` de la generación diaria (app/(app)/layout.tsx). */
const MAX_DURATION_MS = 60_000;

type Call = { model: string; timeout: number; startedAt: number };

/**
 * Cada llamada al SDK simulado pasa por `respond`, que decide qué devuelve el
 * modelo. El tiempo es falso: una llamada "lenta" adelanta el reloj en vez de
 * esperar de verdad.
 */
function stubModels(respond: (call: Call) => string | Error | { after: number; result: string | Error }) {
  const calls: Call[] = [];
  generateContent.mockImplementation(async (req: { model: string; config: { httpOptions: { timeout: number } } }) => {
    const call = { model: req.model, timeout: req.config.httpOptions.timeout, startedAt: Date.now() };
    calls.push(call);
    let outcome = respond(call);
    if (typeof outcome === "object" && !(outcome instanceof Error)) {
      vi.setSystemTime(Date.now() + outcome.after);
      outcome = outcome.result;
    }
    if (outcome instanceof Error) throw outcome;
    return { text: outcome };
  });
  return calls;
}

function timeoutError(): Error {
  const err = new Error("The operation was aborted due to timeout");
  err.name = "TimeoutError";
  return err;
}

/** Simula que el modelo no responde y agota el tope entero del intento. */
const hangs = (call: Call) => ({ after: call.timeout, result: timeoutError() });

const generate = () => createGeminiProvider().generate({ prompt: "p" });

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T08:00:00Z"));
  generateContent.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("cascada de Gemini", () => {
  it("empieza por el modelo más capaz y devuelve cuál respondió", async () => {
    const calls = stubModels(() => "ok");

    await expect(generate()).resolves.toEqual({ text: "ok", model: "gemini-3.8-flash" });
    expect(calls.map((c) => c.model)).toEqual(["gemini-3.8-flash"]);
  });

  it("recorre exactamente los cuatro modelos, en orden", async () => {
    const calls = stubModels(() => new Error("500 INTERNAL"));

    await expect(generate()).rejects.toThrow(/gemini_all_models_failed/);
    expect([...new Set(calls.map((c) => c.model))]).toEqual(CASCADE);
  });

  it("ante un 404 salta al siguiente modelo sin reintentar", async () => {
    const calls = stubModels(({ model }) =>
      model === "gemini-3.8-flash" ? new Error("404 NOT_FOUND: model not found") : "ok"
    );

    await expect(generate()).resolves.toMatchObject({ model: "gemini-3.6-flash" });
    expect(calls.map((c) => c.model)).toEqual(["gemini-3.8-flash", "gemini-3.6-flash"]);
  });

  it("ante un 429 salta al siguiente modelo sin reintentar", async () => {
    const calls = stubModels(({ model }) =>
      model === "gemini-3.8-flash" ? new Error("429 RESOURCE_EXHAUSTED: quota exceeded") : "ok"
    );

    await expect(generate()).resolves.toMatchObject({ model: "gemini-3.6-flash" });
    expect(calls.map((c) => c.model)).toEqual(["gemini-3.8-flash", "gemini-3.6-flash"]);
  });

  it("reintenta una vez un fallo transitorio del mismo modelo", async () => {
    let failed = false;
    const calls = stubModels(() => {
      if (failed) return "ok";
      failed = true;
      return new Error("503 UNAVAILABLE");
    });

    await expect(generate()).resolves.toMatchObject({ model: "gemini-3.8-flash" });
    expect(calls.map((c) => c.model)).toEqual(["gemini-3.8-flash", "gemini-3.8-flash"]);
  });

  it("Gemma responde aunque todos los Gemini se queden sin cuota", async () => {
    const calls = stubModels(({ model }) =>
      model.startsWith("gemini") ? new Error("429 RESOURCE_EXHAUSTED") : "consejo"
    );

    await expect(generate()).resolves.toEqual({ text: "consejo", model: "gemma-4-31b-it" });
    expect(calls.map((c) => c.model)).toEqual(CASCADE);
  });

  describe("peor caso: todo agota el tiempo", () => {
    it("Gemma recibe un intento completo dentro de maxDuration", async () => {
      const start = Date.now();
      const calls = stubModels((call) =>
        call.model === "gemma-4-31b-it" ? { after: call.timeout, result: "consejo" } : hangs(call)
      );

      await expect(generate()).resolves.toMatchObject({ model: "gemma-4-31b-it" });

      const gemma = calls.find((c) => c.model === "gemma-4-31b-it")!;
      // Gemma mide ~8 s con el prompt real: un tope menor la dejaría fuera.
      expect(gemma.timeout).toBeGreaterThanOrEqual(10_000);
      // Margen para el render, las lecturas y el guardado del consejo.
      expect(Date.now() - start).toBeLessThanOrEqual(MAX_DURATION_MS - 10_000);
    });

    it("un fallo transitorio lento que se reintenta no le roba el turno a Gemma", async () => {
      const start = Date.now();
      // Cada Gemini tarda casi el tope y devuelve un 5xx, que sí se reintenta.
      const calls = stubModels((call) =>
        call.model === "gemma-4-31b-it"
          ? { after: call.timeout, result: "consejo" }
          : { after: call.timeout - 1, result: new Error("500 INTERNAL") }
      );

      await expect(generate()).resolves.toMatchObject({ model: "gemma-4-31b-it" });

      const gemma = calls.find((c) => c.model === "gemma-4-31b-it")!;
      expect(gemma.timeout).toBeGreaterThanOrEqual(10_000);
      expect(Date.now() - start).toBeLessThanOrEqual(MAX_DURATION_MS - 10_000);
      // Un reintento sin tiempo para responder no se lanza: sólo gastaría cuota.
      expect(calls.every((c) => c.timeout >= 4_000)).toBe(true);
    });

    it("sin respuesta de nadie, falla antes de maxDuration", async () => {
      const start = Date.now();
      stubModels(hangs);

      await expect(generate()).rejects.toThrow(/gemini_all_models_failed/);
      expect(Date.now() - start).toBeLessThanOrEqual(MAX_DURATION_MS - 10_000);
    });
  });
});
