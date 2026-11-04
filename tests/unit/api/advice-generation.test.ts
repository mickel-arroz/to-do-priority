// @vitest-environment node
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDailyAdviceGeneration } from "@/lib/advice-generation";
import { createAdviceProvider } from "@/lib/ai/provider";
import { NEW_ADVICE_EVENT } from "@/lib/live-sync";
import { fakeSupabase, type RpcResolver } from "./fake-supabase";

vi.mock("@/lib/ai/provider", () => ({ createAdviceProvider: vi.fn() }));

const TODAY = "2026-10-12";

const pendingTask = {
  id: "t1",
  user_id: "u1",
  category_id: "c1",
  title: "Regar",
  description: null,
  link: null,
  due_date: TODAY,
  priority: 1,
  status: "pending",
  completed_at: null,
  pomodoro_minutes: 25,
  recurrence_type: "none",
  recurrence_weekdays: null,
  recurrence_interval: 1,
  recurrence_parent_id: null,
  created_at: "",
  updated_at: "",
  subtasks: [],
};

const generate = vi.fn();

/** Una respuesta válida de la IA: sólo el consejo de inicio. */
const adviceText = JSON.stringify({
  home: { es: "Riega primero", en: "Water first" },
  habits: [],
});

/** Un usuario con una tarea pendiente y sin intentos hoy: la generación sigue. */
function run({
  userAdvice = null,
  rpc,
  failBroadcast,
}: {
  userAdvice?: unknown;
  rpc?: RpcResolver;
  failBroadcast?: boolean;
} = {}) {
  const fake = fakeSupabase(
    (op) => {
      if (op.table === "user_advice") return userAdvice;
      if (op.table === "tasks") return [pendingTask];
      return op.single ? null : [];
    },
    {
      failBroadcast,
      rpc:
        rpc ??
        ((name) =>
          name === "claim_advice_day" ? { data: true, error: null } : undefined),
    }
  );
  const done = runDailyAdviceGeneration(
    fake.ctx.supabase as unknown as SupabaseClient,
    "u1",
    TODAY
  );
  return { ...fake, done };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  generate.mockResolvedValue({ text: adviceText, model: "gemini-test" });
  vi.mocked(createAdviceProvider).mockResolvedValue({ generate });
});

describe("la generación diaria avisa del consejo nuevo", () => {
  it("tras guardar consejos publica el aviso de consejo nuevo, sin origin", async () => {
    const { done, broadcasts } = run();
    await done;

    expect(generate).toHaveBeenCalledTimes(1);
    expect(broadcasts).toEqual([
      { channel: "user:u1", private: true, event: NEW_ADVICE_EVENT, payload: {} },
    ]);
  });

  it("si el día ya tiene consejo se salta y no publica", async () => {
    const { done, broadcasts } = run({
      userAdvice: {
        last_attempt_date: TODAY,
        last_advice_date: TODAY,
        attempt_count: 1,
        home_advice_es: "Ya hay",
      },
    });
    await done;

    expect(generate).not.toHaveBeenCalled();
    expect(broadcasts).toEqual([]);
  });

  it("si otra ejecución se llevó el intento no publica", async () => {
    const { done, broadcasts } = run({
      rpc: (name) =>
        name === "claim_advice_day" ? { data: false, error: null } : undefined,
    });
    await done;

    expect(generate).not.toHaveBeenCalled();
    expect(broadcasts).toEqual([]);
  });

  it("si la IA falla no publica", async () => {
    generate.mockRejectedValue(new Error("ai_down"));
    const { done, broadcasts } = run();
    await done;

    expect(broadcasts).toEqual([]);
  });

  it("si no se pudo guardar no publica", async () => {
    const { done, broadcasts } = run({
      rpc: (name) =>
        name === "claim_advice_day"
          ? { data: true, error: null }
          : { data: null, error: { message: "save_failed" } },
    });
    await done;

    expect(generate).toHaveBeenCalledTimes(1);
    expect(broadcasts).toEqual([]);
  });

  it("un fallo al publicar no rompe la generación", async () => {
    const saved = vi.fn();
    const { done } = run({
      failBroadcast: true,
      rpc: (name) => {
        if (name === "save_daily_advice") saved();
        return name === "claim_advice_day" ? { data: true, error: null } : undefined;
      },
    });

    await expect(done).resolves.toBeUndefined();
    expect(saved).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });
});
