import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sortByDateAndPriority, sortCompletedToday } from "@/lib/tasks";
import { attachImageUrls } from "@/lib/task-images";
import type { DayRange } from "@/lib/timezone";
import type { Task } from "@/lib/types";

/** Qué listado de tareas pinta un `TaskBoard`. */
export type BoardScope =
  | { kind: "home" }
  | { kind: "category"; categoryId: string };

export type BoardData = {
  /** Tareas pendientes del alcance, con sus subtareas e imágenes firmadas */
  tasks: Task[];
  /** Sólo en el home: lo cerrado dentro del día del usuario */
  completedToday?: Task[];
};

const categoryIdSchema = z.string().uuid();

/** Si el id puede ser el de una categoría; si no, la consulta fallaría. */
export function isCategoryId(id: string): boolean {
  return categoryIdSchema.safeParse(id).success;
}

/**
 * El alcance pedido en la query de `GET /api/tasks/board`: `?scope=home` o
 * `?scope=category&categoryId=<uuid>`. Null si no es ninguno de los dos.
 */
export function parseBoardScope(params: URLSearchParams): BoardScope | null {
  const scope = params.get("scope");
  if (scope === "home") return { kind: "home" };
  const categoryId = params.get("categoryId");
  if (scope === "category" && categoryId && isCategoryId(categoryId)) {
    return { kind: "category", categoryId };
  }
  return null;
}

/**
 * El listado de tareas de un alcance, tal como lo pintan el home y las páginas
 * de categoría. Es la única consulta: la usan esas páginas al renderizar y
 * `GET /api/tasks/board` al reconciliar, así que ambos caminos coinciden.
 *
 * `today` es el día del usuario como rango de instantes (ADR 0003): una tarea
 * cuenta como completada hoy si se cerró entre su medianoche y la siguiente.
 */
export async function loadTaskBoard(
  supabase: SupabaseClient,
  scope: BoardScope,
  today: DayRange
): Promise<BoardData> {
  let pending = supabase
    .from("tasks")
    .select("*, subtasks(*), task_images(*)")
    .eq("status", "pending");
  if (scope.kind === "category") {
    pending = pending.eq("category_id", scope.categoryId);
  }

  const [{ data: tasks, error }, completed] = await Promise.all([
    pending,
    scope.kind === "home"
      ? supabase
          .from("tasks")
          .select("*")
          .in("status", ["yes", "no"])
          .gte("completed_at", today.start)
          .lt("completed_at", today.end)
      : null,
  ]);
  if (error) throw error;
  if (completed?.error) throw completed.error;

  const withImages = await attachImageUrls(supabase, (tasks ?? []) as Task[]);

  if (scope.kind === "category") {
    return { tasks: sortByDateAndPriority(withImages) };
  }
  return {
    tasks: withImages,
    completedToday: sortCompletedToday((completed?.data ?? []) as Task[]),
  };
}
