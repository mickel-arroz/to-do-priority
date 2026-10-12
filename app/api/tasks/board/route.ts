import { NextResponse } from "next/server";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";
import { getUserToday } from "@/lib/server-today";
import { loadTaskBoard, parseBoardScope } from "@/lib/task-board";

/**
 * El listado de tareas de un `TaskBoard`, para reconciliar sin recargar la
 * página. `?scope=home` trae las pendientes y lo completado en el día del
 * usuario; `?scope=category&categoryId=` trae las pendientes de esa lista.
 */
export async function GET(request: Request) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const scope = parseBoardScope(new URL(request.url).searchParams);
  if (!scope) return jsonError("invalid_scope", 400);

  const { todayRange } = await getUserToday();
  try {
    return NextResponse.json(await loadTaskBoard(ctx.supabase, scope, todayRange));
  } catch (error) {
    return jsonError((error as Error).message, 500);
  }
}
