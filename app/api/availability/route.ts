import { NextResponse } from "next/server";
import {
  isUnauthorized,
  jsonError,
  requireUser,
  type AuthContext,
} from "@/app/api/_lib/auth";
import { notifyChange } from "@/app/api/_lib/live-sync";
import { busyBlocksSchema, validationErrorResponse } from "@/app/api/_lib/schemas";
import { normalizeBusyBlocks, resolveSleepHours } from "@/lib/availability";

/**
 * La columna `profiles.sleep_hours` llega con la migración 0012, que se aplica
 * a mano. Hasta entonces PostgREST responde que no existe (42703 al leerla,
 * PGRST204 al escribirla) y la ruta sigue como antes: 7 horas fijas.
 */
function isMissingSleepColumn(error: { code?: string } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

async function readSleepHours(ctx: AuthContext): Promise<number> {
  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("sleep_hours")
    .eq("id", ctx.user.id)
    .maybeSingle();
  if (error && !isMissingSleepColumn(error)) {
    console.error("[availability] no se pudo leer sleep_hours", error.message);
  }
  return resolveSleepHours((data as { sleep_hours?: unknown } | null)?.sleep_hours);
}

export async function GET() {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const [{ data, error }, sleepHours] = await Promise.all([
    ctx.supabase
      .from("busy_blocks")
      .select("*")
      .order("weekday")
      .order("start_minute"),
    readSleepHours(ctx),
  ]);

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ blocks: data, sleep_hours: sleepHours });
}

/**
 * Reemplaza la disponibilidad entera: la semana y, si viene, las horas de
 * sueño. No hay PATCH: el formulario edita todo como una unidad y mandar sólo
 * un día dejaría al cliente adivinando qué quedó en el servidor. Un
 * `blocks: []` deja al usuario sin tiempo ocupado.
 */
export async function PUT(request: Request) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const body = await request.json().catch(() => null);
  const parsed = busyBlocksSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { sleep_hours } = parsed.data;
  if (sleep_hours !== undefined) {
    const { error } = await ctx.supabase
      .from("profiles")
      .update({ sleep_hours })
      .eq("id", ctx.user.id);
    // Sin la migración 0012 el valor no tiene dónde guardarse: se descarta y
    // se guarda la semana igual, en vez de bloquear el formulario entero.
    if (error && !isMissingSleepColumn(error)) return jsonError(error.message, 500);
  }

  // Se normaliza aquí también, no sólo en el formulario: lo que entra a la
  // tabla ya viene ordenado y sin solapes, venga de donde venga.
  const blocks = normalizeBusyBlocks(parsed.data.blocks);

  const { error } = await ctx.supabase.rpc("save_busy_blocks", {
    p_blocks: blocks,
  });
  if (error) return jsonError(error.message, 500);

  await notifyChange(ctx, request);
  return NextResponse.json({
    blocks,
    sleep_hours: sleep_hours ?? (await readSleepHours(ctx)),
  });
}
