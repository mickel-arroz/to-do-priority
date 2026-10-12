import type { AuthContext } from "@/app/api/_lib/auth";

/**
 * Doble mínimo del cliente de Supabase para probar rutas y helpers de la API
 * sin base de datos. Registra cada operación terminada (`ops`) y delega en un
 * `resolve` por test qué datos devuelve cada una.
 *
 * Sólo cubre la superficie encadenable que usan las rutas: from → select /
 * insert / update / upsert / delete → eq / in / gte / lt / order / limit →
 * single / maybeSingle → await. Las columnas pedidas al `select` se ignoran:
 * el `resolve` decide la forma de lo que devuelve.
 */
export type FakeOp = {
  table: string;
  action: "select" | "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  filters: Array<{
    kind: "eq" | "in" | "gte" | "lt";
    column: string;
    value: unknown;
  }>;
  single: boolean;
};

export type Resolver = (op: FakeOp) => unknown;

class Builder implements PromiseLike<{ data: unknown; error: null }> {
  private op: FakeOp;

  constructor(
    table: string,
    private readonly ops: FakeOp[],
    private readonly resolve: Resolver
  ) {
    this.op = { table, action: "select", filters: [], single: false };
  }

  select() {
    return this;
  }
  insert(payload: unknown) {
    this.op.action = "insert";
    this.op.payload = payload;
    return this;
  }
  update(payload: unknown) {
    this.op.action = "update";
    this.op.payload = payload;
    return this;
  }
  upsert(payload: unknown) {
    this.op.action = "upsert";
    this.op.payload = payload;
    return this;
  }
  delete() {
    this.op.action = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.op.filters.push({ kind: "eq", column, value });
    return this;
  }
  in(column: string, value: unknown) {
    this.op.filters.push({ kind: "in", column, value });
    return this;
  }
  gte(column: string, value: unknown) {
    this.op.filters.push({ kind: "gte", column, value });
    return this;
  }
  lt(column: string, value: unknown) {
    this.op.filters.push({ kind: "lt", column, value });
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  single() {
    this.op.single = true;
    return this;
  }
  maybeSingle() {
    this.op.single = true;
    return this;
  }

  then<R1 = { data: unknown; error: null }, R2 = never>(
    onFulfilled?: (v: { data: unknown; error: null }) => R1 | PromiseLike<R1>,
    onRejected?: (reason: unknown) => R2 | PromiseLike<R2>
  ): PromiseLike<R1 | R2> {
    this.ops.push(this.op);
    const data = this.resolve(this.op) ?? null;
    return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
  }
}

/** Un aviso publicado por Realtime Broadcast desde la ruta. */
export type FakeBroadcast = {
  channel: string;
  private: boolean;
  event: string;
  payload: unknown;
};

export function fakeSupabase(
  resolve: Resolver = () => null,
  { failBroadcast = false }: { failBroadcast?: boolean } = {}
) {
  const ops: FakeOp[] = [];
  const broadcasts: FakeBroadcast[] = [];
  const supabase = {
    from: (table: string) => new Builder(table, ops, resolve),
    storage: { from: () => ({ remove: async () => ({ data: null, error: null }) }) },
    rpc: async () => ({ data: null, error: null }),
    realtime: { setAuth: async () => {} },
    channel: (name: string, opts?: { config?: { private?: boolean } }) => ({
      httpSend: async (event: string, payload: unknown) => {
        if (failBroadcast) throw new Error("realtime_down");
        broadcasts.push({
          channel: name,
          private: opts?.config?.private ?? false,
          event,
          payload,
        });
        return { success: true };
      },
    }),
    removeChannel: async () => "ok",
  };
  const ctx = {
    supabase,
    user: { id: "u1" },
  } as unknown as AuthContext;
  return { ctx, ops, broadcasts };
}

/** Filtro `eq` de una operación, por nombre de columna. */
export function eqOf(op: FakeOp, column: string) {
  return op.filters.find((f) => f.kind === "eq" && f.column === column)?.value;
}

/** Instante de una marca ISO, o null si el valor no es una fecha con hora. */
function instantOf(value: unknown): number | null {
  if (typeof value !== "string" || !value.includes("T")) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function compare(a: unknown, b: unknown): number {
  const ta = instantOf(a);
  const tb = instantOf(b);
  if (ta !== null && tb !== null) return ta - tb;
  return String(a).localeCompare(String(b));
}

/**
 * Aplica los filtros de una operación a filas en memoria, para los tests que
 * necesitan que el doble filtre como la base. Las marcas de tiempo se
 * comparan como instantes, igual que `timestamptz`.
 */
export function applyFilters<T extends Record<string, unknown>>(
  rows: T[],
  op: FakeOp
): T[] {
  return rows.filter((row) =>
    op.filters.every((f) => {
      const value = row[f.column];
      switch (f.kind) {
        case "eq":
          return value === f.value;
        case "in":
          return (f.value as unknown[]).includes(value);
        case "gte":
          return value != null && compare(value, f.value) >= 0;
        case "lt":
          return value != null && compare(value, f.value) < 0;
      }
    })
  );
}
