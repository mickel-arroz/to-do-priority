import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_BLOCKS_PER_DAY, MINUTES_IN_DAY } from "@/lib/availability";
import { LIMITS } from "@/lib/limits";

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
    .array(z.object({ title: z.string().trim().min(1).max(LIMITS.subtaskTitle) }))
    .max(50)
    .optional(),
});

export const habitBaseSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.habitName),
  description: z.string().max(LIMITS.habitDescription).nullish(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  target_days: z.number().int().positive().nullish(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  punishment_enabled: z.boolean().optional(),
  task_ids: z.array(z.string().uuid()).min(1).max(50),
});

// A fixed target date must not be before the start date (front also blocks
// past dates). Only checked when both are present.
const futureEndDate = (v: { start_date?: string; end_date?: string | null }) =>
  !v.end_date || !v.start_date || v.end_date > v.start_date;

export const habitSchema = habitBaseSchema.refine(futureEndDate, {
  error: "end_date_not_future",
  path: ["end_date"],
});

export const habitUpdateSchema = habitBaseSchema
  .partial()
  .refine(futureEndDate, { error: "end_date_not_future", path: ["end_date"] });

/**
 * La disponibilidad se guarda entera: el cuerpo trae la semana completa y
 * reemplaza a la anterior, así que una lista vacía es válida y significa
 * "disponible 24/7". Los solapes no se rechazan, se funden al normalizar.
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
});

/**
 * Turn a Zod failure into a specific client error. String length overflows
 * return `too_long` with the offending field + max so the UI can show an exact
 * message instead of a generic one; anything else stays `invalid_payload`.
 */
export function validationErrorResponse(error: z.ZodError) {
  const tooBig = error.issues.find((i) => i.code === "too_big");
  if (tooBig) {
    const path = tooBig.path;
    const field =
      path[0] === "subtasks"
        ? "subtask"
        : String(path[path.length - 1] ?? "");
    const max = Number(
      (tooBig as { maximum?: number | bigint }).maximum ?? 0
    );
    return NextResponse.json({ error: "too_long", field, max }, { status: 400 });
  }
  // Custom refine failures carry a machine code as their message
  const custom = error.issues.find((i) => i.code === "custom");
  if (custom && typeof custom.message === "string") {
    return NextResponse.json({ error: custom.message }, { status: 400 });
  }
  return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
}
