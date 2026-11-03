import { NextResponse } from "next/server";
import { z } from "zod";
import {
  MAX_BLOCKS_PER_DAY,
  MAX_SLEEP_HOURS,
  MIN_SLEEP_HOURS,
  MINUTES_IN_DAY,
} from "@/lib/availability";
import { LIMITS } from "@/lib/limits";

/**
 * Un título de subtarea, con el mismo tope en las tres superficies que lo
 * aceptan: la creación de tarea con subtareas, el POST y el PATCH de la ruta
 * de subtareas.
 */
export const subtaskTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(LIMITS.subtaskTitle);

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.taskTitle),
  description: z.string().max(LIMITS.taskDescription).nullish(),
  category_id: z.string().uuid(),
  link: z.string().url().nullish().or(z.literal("").transform(() => null)),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  priority: z.number().int().min(1).max(4),
  pomodoro_minutes: z.number().int().min(0).max(180).optional(),
  recurrence_type: z
    .enum(["none", "daily", "weekly", "monthly", "yearly"])
    .optional(),
  recurrence_weekdays: z.array(z.number().int().min(0).max(6)).nullish(),
  recurrence_interval: z.number().int().min(1).max(60).optional(),
  subtasks: z
    .array(z.object({ title: subtaskTitleSchema }))
    .max(LIMITS.subtasksPerTask)
    .optional(),
});

/** Tareas vinculadas a un hábito; el tope limita la selección del formulario. */
const habitTaskIds = z.array(z.string().uuid()).max(LIMITS.tasksPerHabit);

export const habitBaseSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.habitName),
  description: z.string().max(LIMITS.habitDescription).nullish(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  target_days: z.number().int().positive().nullish(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  punishment_enabled: z.boolean().optional(),
  task_ids: habitTaskIds.min(1),
});

// A fixed target date must not be before the start date (front also blocks
// past dates). Only checked when both are present.
const futureEndDate = (v: { start_date?: string; end_date?: string | null }) =>
  !v.end_date || !v.start_date || v.end_date > v.start_date;

export const habitSchema = habitBaseSchema.refine(futureEndDate, {
  error: "end_date_not_future",
  path: ["end_date"],
});

// Al editar, `task_ids` son sólo las tareas pendientes: las cerradas las
// conserva el servidor, así que la lista puede llegar vacía si queda historial.
export const habitUpdateSchema = habitBaseSchema
  .extend({ task_ids: habitTaskIds })
  .partial()
  .refine(futureEndDate, { error: "end_date_not_future", path: ["end_date"] });

/**
 * La disponibilidad se guarda entera: el cuerpo trae la semana completa y
 * reemplaza a la anterior, así que una lista vacía es válida y significa
 * "sin tiempo ocupado". Los solapes no se rechazan, se funden al normalizar.
 *
 * `sleep_hours` es opcional para que un cliente anterior, que sólo manda los
 * bloques, siga funcionando sin tocar las horas de sueño guardadas.
 */
export const busyBlocksSchema = z.object({
  blocks: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        start_minute: z.number().int().min(0).max(MINUTES_IN_DAY - 1),
        end_minute: z.number().int().min(1).max(MINUTES_IN_DAY),
      })
    )
    .max(MAX_BLOCKS_PER_DAY * 7),
  sleep_hours: z.number().int().min(MIN_SLEEP_HOURS).max(MAX_SLEEP_HOURS).optional(),
});

/** El código de cliente de cada clase de `too_big`, según lo que se pasó. */
const TOO_BIG_CODES: Record<string, string> = {
  string: "too_long",
  array: "too_many",
  number: "too_large",
  int: "too_large",
};

/**
 * Turn a Zod failure into a specific client error. Overflows return the
 * offending field + max so the UI can show an exact message instead of a
 * generic one, with a code per kind: `too_long` for a text's length,
 * `too_many` for a list's items, `too_large` for a number's value. Anything
 * else stays `invalid_payload`.
 */
export function validationErrorResponse(error: z.ZodError) {
  const tooBig = error.issues.find((i) => i.code === "too_big");
  const code = tooBig && TOO_BIG_CODES[tooBig.origin];
  if (tooBig && code) {
    const path = tooBig.path;
    // El título de una subtarea se informa como `subtask`, no por su índice
    const field =
      code === "too_long" && path[0] === "subtasks"
        ? "subtask"
        : String(path[path.length - 1] ?? "");
    return NextResponse.json(
      { error: code, field, max: Number(tooBig.maximum) },
      { status: 400 }
    );
  }
  // Custom refine failures carry a machine code as their message
  const custom = error.issues.find((i) => i.code === "custom");
  if (custom && typeof custom.message === "string") {
    return NextResponse.json({ error: custom.message }, { status: 400 });
  }
  return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
}
