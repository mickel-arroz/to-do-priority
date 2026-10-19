// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireUser } from "@/app/api/_lib/auth";
import { GET, PUT } from "@/app/api/availability/route";
import { eqOf, fakeSupabase, type Resolver } from "./fake-supabase";

vi.mock("@/app/api/_lib/auth", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/app/api/_lib/auth")>();
  return { ...mod, requireUser: vi.fn() };
});

function withDb(resolve: Resolver = () => null) {
  const fake = fakeSupabase(resolve);
  vi.mocked(requireUser).mockResolvedValue(fake.ctx);
  return fake;
}

const put = (body: unknown) =>
  PUT(
    new Request("http://test", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    })
  );

beforeEach(() => {
  vi.mocked(requireUser).mockReset();
});

describe("/api/availability y las horas de sueño", () => {
  it("devuelve las horas guardadas junto a la semana", async () => {
    withDb((op) => (op.table === "profiles" ? { sleep_hours: 9 } : []));
    const res = await GET();
    expect(await res.json()).toEqual({ blocks: [], sleep_hours: 9 });
  });

  it("cae a 7 si el perfil no trae el campo (esquema sin la migración 0012)", async () => {
    withDb((op) => (op.table === "profiles" ? {} : []));
    const res = await GET();
    expect((await res.json()).sleep_hours).toBe(7);
  });

  it("guarda las horas de sueño en el perfil del usuario", async () => {
    const fake = withDb();
    const res = await put({ blocks: [], sleep_hours: 0 });
    expect(res.status).toBe(200);
    const update = fake.ops.find((op) => op.table === "profiles" && op.action === "update");
    expect(update?.payload).toEqual({ sleep_hours: 0 });
    expect(eqOf(update!, "id")).toBe("u1");
    expect((await res.json()).sleep_hours).toBe(0);
  });

  it("acepta el día entero de sueño", async () => {
    withDb();
    expect((await put({ blocks: [], sleep_hours: 24 })).status).toBe(200);
  });

  it.each([-1, 25, 7.5, "7", null])("rechaza sleep_hours = %j", async (value) => {
    const fake = withDb();
    const res = await put({ blocks: [], sleep_hours: value });
    expect(res.status).toBe(400);
    expect(fake.ops.some((op) => op.table === "profiles")).toBe(false);
  });

  it("sigue aceptando a un cliente que sólo manda los bloques", async () => {
    const fake = withDb((op) => (op.table === "profiles" ? { sleep_hours: 8 } : null));
    const res = await put({ blocks: [] });
    expect(res.status).toBe(200);
    expect(fake.ops.some((op) => op.action === "update")).toBe(false);
    expect((await res.json()).sleep_hours).toBe(8);
  });
});
