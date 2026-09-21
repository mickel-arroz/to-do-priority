import type { AuthContext } from "@/app/api/_lib/auth";

/**
 * Doble mínimo del cliente de Supabase para probar rutas y helpers de la API
 * sin base de datos. Registra cada operación terminada (`ops`) y delega en un
 * `resolve` por test qué datos devuelve cada una.
 *
 * Sólo cubre la superficie encadenable que usan las rutas: from → select /
 * insert / update / upsert / delete → eq / in / gte / order / limit →
 * single / maybeSingle → await. Las columnas pedidas al `select` se ignoran:
 * el `resolve` decide la forma de lo que devuelve.
 */
export type FakeOp = {
  table: string;
  action: "select" | "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  filters: Array<{ kind: "eq" | "in" | "gte"; column: string; value: unknown }>;
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

export function fakeSupabase(resolve: Resolver = () => null) {
  const ops: FakeOp[] = [];
  const supabase = {
    from: (table: string) => new Builder(table, ops, resolve),
    storage: { from: () => ({ remove: async () => ({ data: null, error: null }) }) },
  };
  const ctx = {
    supabase,
    user: { id: "u1" },
  } as unknown as AuthContext;
  return { ctx, ops };
}

/** Filtro `eq` de una operación, por nombre de columna. */
export function eqOf(op: FakeOp, column: string) {
  return op.filters.find((f) => f.kind === "eq" && f.column === column)?.value;
}
