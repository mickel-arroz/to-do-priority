import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullish(),
  category_id: z.string().uuid(),
  link: z.string().url().nullish().or(z.literal("").transform(() => null)),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  priority: z.number().int().min(1).max(4),
  pomodoro_minutes: z.number().int().min(0).max(180).optional(),
  recurrence_type: z
    .enum(["none", "daily", "weekly", "monthly", "yearly"])
    .optional(),
  recurrence_weekdays: z.array(z.number().int().min(0).max(6)).nullish(),
  recurrence_interval: z.number().int().min(1).max(52).optional(),
  subtasks: z
    .array(z.object({ title: z.string().trim().min(1).max(200) }))
    .max(50)
    .optional(),
});

export const habitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).nullish(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  target_days: z.number().int().positive().nullish(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  punishment_enabled: z.boolean().optional(),
  task_ids: z.array(z.string().uuid()).min(1).max(50),
});
