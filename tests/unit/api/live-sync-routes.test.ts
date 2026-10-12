// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireUser } from "@/app/api/_lib/auth";
import { PUT as saveAvailability } from "@/app/api/availability/route";
import { POST as createCategory } from "@/app/api/categories/route";
import { DELETE as deleteHabit } from "@/app/api/habits/[id]/route";
import { POST as completeTask } from "@/app/api/tasks/[id]/complete/route";
import { POST as changeStatus } from "@/app/api/tasks/[id]/status/route";
import { DELETE as deleteSubtask } from "@/app/api/tasks/[id]/subtasks/route";
import { CHANGE_EVENT, CLIENT_ID_HEADER } from "@/lib/live-sync";
import { fakeSupabase, type Resolver } from "./fake-supabase";

vi.mock("@/app/api/_lib/auth", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/app/api/_lib/auth")>();
  return { ...mod, requireUser: vi.fn() };
});

vi.mock("@/app/api/_lib/habit-day", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/app/api/_lib/habit-day")>();
  return {
    ...mod,
    syncHabitDays: vi.fn(),
    syncHabitDaysForTask: vi.fn(),
    linkedHabitIds: vi.fn(async () => []),
  };
});

const CLIENT = "pestaña-1";

function withDb(resolve: Resolver = () => null, opts?: { failBroadcast?: boolean }) {
  const fake = fakeSupabase(resolve, opts);
  vi.mocked(requireUser).mockResolvedValue(fake.ctx);
  return fake;
}

function req(
  method: string,
  body?: unknown,
  { url = "http://test", clientId = CLIENT }: { url?: string; clientId?: string | null } = {}
) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (clientId) headers[CLIENT_ID_HEADER] = clientId;
  return new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

const task = {
  id: "t1",
  title: "Regar",
  status: "pending",
  due_date: "2026-10-12",
  recurrence_type: "none",
  recurrence_parent_id: null,
  completed_at: null,
  subtasks: [],
};

/** Una tarea en `status` que pasa a `next` al actualizarla. */
function taskDb(status: string, next: string): Resolver {
  return (op) =>
    op.table === "tasks" && op.single
      ? { ...task, status: op.action === "update" ? next : status }
      : null;
}

const close = () => completeTask(req("POST", { status: "yes" }), params("t1"));

beforeEach(() => {
  vi.mocked(requireUser).mockReset();
});

describe("las rutas que modifican datos avisan al canal del usuario", () => {
  it.each<[string, Resolver, () => Promise<Response>]>([
    ["cerrar una tarea", taskDb("pending", "yes"), close],
    [
      "cambiar el estado de una cerrada",
      taskDb("yes", "no"),
      () => changeStatus(req("POST", { status: "no" }), params("t1")),
    ],
    [
      "crear una categoría",
      (op) => (op.single ? { id: "c1", name: "Casa" } : null),
      () => createCategory(req("POST", { name: "Casa" })),
    ],
    [
      "guardar el tiempo ocupado",
      () => null,
      () => saveAvailability(req("PUT", { blocks: [] })),
    ],
    [
      "borrar una subtarea",
      () => null,
      () =>
        deleteSubtask(
          req("DELETE", undefined, { url: "http://test?subtaskId=s1" }),
          params("t1")
        ),
    ],
    ["borrar un hábito", () => null, () => deleteHabit(req("DELETE"), params("h1"))],
  ])("%s publica el aviso con el clientId del header", async (_, resolve, call) => {
    const { broadcasts } = withDb(resolve);

    const res = await call();

    expect(res.status).toBeLessThan(300);
    expect(broadcasts).toEqual([
      {
        channel: "user:u1",
        private: true,
        event: CHANGE_EVENT,
        payload: { origin: CLIENT },
      },
    ]);
  });

  it("sin header el aviso va sin origen, para que todas las pestañas refresquen", async () => {
    const { broadcasts } = withDb(taskDb("pending", "yes"));
    await completeTask(req("POST", { status: "yes" }, { clientId: null }), params("t1"));
    expect(broadcasts.map((b) => b.payload)).toEqual([{ origin: null }]);
  });

  it("un fallo al publicar no hace fallar la mutación", async () => {
    const { ops } = withDb(taskDb("pending", "yes"), { failBroadcast: true });

    const res = await close();

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ task: { status: "yes" } });
    expect(ops.some((op) => op.table === "tasks" && op.action === "update")).toBe(true);
  });

  it("una mutación rechazada no avisa", async () => {
    const { broadcasts } = withDb(taskDb("yes", "yes"));

    const res = await close();

    expect(res.status).toBe(409);
    expect(broadcasts).toEqual([]);
  });
});
