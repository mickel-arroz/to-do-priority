import { NextResponse } from "next/server";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";
import { busyBlocksSchema, validationErrorResponse } from "@/app/api/_lib/schemas";
import { normalizeBusyBlocks } from "@/lib/availability";

export async function GET() {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { data, error } = await ctx.supabase
    .from("busy_blocks")
    .select("*")
    .order("weekday")
    .order("start_minute");

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ blocks: data });
}

/**
 * Reemplaza la disponibilidad entera. No hay PATCH: el formulario edita la
 * semana como una unidad y mandar sólo un día dejaría al cliente adivinando
 * qué quedó en el servidor. Un `blocks: []` es la forma de volver a 24/7.
 */
export async function PUT(request: Request) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const body = await request.json().catch(() => null);
  const parsed = busyBlocksSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  // Se normaliza aquí también, no sólo en el formulario: lo que entra a la
  // tabla ya viene ordenado y sin solapes, venga de donde venga.
  const blocks = normalizeBusyBlocks(parsed.data.blocks);

  const { error } = await ctx.supabase.rpc("save_busy_blocks", {
    p_blocks: blocks,
  });
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ blocks });
}
