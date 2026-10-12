// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { GET } from "@/app/api/tasks/board/route";
import { applyFilters, fakeSupabase } from "./fake-supabase";

vi.mock("@/app/api/_lib/auth", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/app/api/_lib/auth")>();
  return { ...mod, requireUser: vi.fn() };
});

// El día del usuario sale de la cookie `tz`, como en producción: un usuario
// en Caracas (UTC−4).
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "tz" ? { value: "America/Caracas" } : undefined,
  }),
  headers: async () => ({ get: () => null }),
}));

const C1 = "11111111-1111-4111-8111-111111111111";
const C2 = "22222222-2222-4222-8222-222222222222";

type Row = {
  id: string;
  category_id: string;
  status: string;
  due_date: string;
  priority: number;
  title: string;
  completed_at: string | null;
  task_images: [];
};

function row(partial: Partial<Row> & { id: string }): Row {
  return {
    category_id: C1,
    status: "pending",
    due_date: "2026-10-12",
    priority: 2,
    title: partial.id,
    completed_at: null,
    task_images: [],
    ...partial,
  };
}

const ROWS: Row[] = [
  row({ id: "p-c1", category_id: C1 }),
  row({ id: "p-c2-late", category_id: C2, due_date: "2026-10-20" }),
  row({ id: "p-c2-soon", category_id: C2, due_date: "2026-10-13" }),
  // 21:00 del 11 en Caracas: ayer para el usuario, aunque en UTC ya sea el 12.
  row({ id: "ayer-noche", status: "yes", completed_at: "2026-10-12T01:00:00Z" }),
  row({ id: "hoy-temprano", status: "no", completed_at: "2026-10-12T04:30:00Z" }),
  row({ id: "hoy", status: "yes", completed_at: "2026-10-12T13:00:00Z" }),
  // Medianoche del 13 en Caracas: ya es mañana.
  row({ id: "manana", status: "yes", completed_at: "2026-10-13T04:00:00Z" }),
];

function withDb() {
  const fake = fakeSupabase((op) =>
    op.table === "tasks" ? applyFilters(ROWS, op) : null
  );
  vi.mocked(requireUser).mockResolvedValue(fake.ctx);
  return fake;
}

const get = (query: string) => GET(new Request(`http://test/api/tasks/board${query}`));
const ids = (tasks: { id: string }[]) => tasks.map((t) => t.id);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // 10:00 del 12 de octubre en Caracas.
  vi.setSystemTime(new Date("2026-10-12T14:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/tasks/board", () => {
  it("responde 401 sin sesión", async () => {
    vi.mocked(requireUser).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await get("?scope=home");
    expect(res.status).toBe(401);
  });

  it("rechaza un alcance desconocido o una categoría sin un id válido", async () => {
    withDb();
    expect((await get("?scope=todo")).status).toBe(400);
    expect((await get("?scope=category")).status).toBe(400);
    expect((await get("?scope=category&categoryId=c2")).status).toBe(400);
  });

  describe("alcance home", () => {
    it("devuelve todas las pendientes", async () => {
      withDb();
      const body = await (await get("?scope=home")).json();
      expect(ids(body.tasks).sort()).toEqual(["p-c1", "p-c2-late", "p-c2-soon"]);
    });

    it("sólo cuenta como completadas hoy las cerradas en el día del usuario", async () => {
      withDb();
      const body = await (await get("?scope=home")).json();
      expect(ids(body.completedToday).sort()).toEqual(["hoy", "hoy-temprano"]);
    });

    it("no muestra como de hoy una tarea cerrada a las 21:00 de ayer en UTC−4", async () => {
      withDb();
      const body = await (await get("?scope=home")).json();
      expect(ids(body.completedToday)).not.toContain("ayer-noche");
    });
  });

  describe("alcance category", () => {
    it("devuelve sólo las pendientes de esa categoría, por fecha", async () => {
      withDb();
      const body = await (await get(`?scope=category&categoryId=${C2}`)).json();
      expect(ids(body.tasks)).toEqual(["p-c2-soon", "p-c2-late"]);
      expect(body.completedToday).toBeUndefined();
    });
  });
});
