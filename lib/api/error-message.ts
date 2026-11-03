import { ApiError } from "@/lib/api/client";
import type { Dictionary } from "@/lib/i18n";

/**
 * Human-readable message for a caught API error. Codes the backend raises on
 * purpose get their own message, so the user sees a specific reason instead of
 * the generic fallback: an overflow names the field and its maximum, worded by
 * kind (`too_long` a text's characters, `too_many` a list's items, `too_large`
 * a number's value), and `subtask_limit_reached` says the task is full.
 */
export function apiErrorMessage(err: unknown, t: Dictionary): string {
  if (!(err instanceof ApiError)) return t.common.error;
  if (err.body?.error === "subtask_limit_reached") {
    return t.tasks.subtaskLimitReached;
  }

  const labels: Record<string, string> = {
    title: t.tasks.title,
    description: t.tasks.description,
    subtask: t.tasks.subtasks,
    subtasks: t.tasks.subtasks,
    name: t.habits.name,
    task_ids: t.habits.linkedTasks,
    pomodoro_minutes: t.tasks.pomodoro,
  };
  const overflows: Record<string, string> = {
    too_long: t.tasks.charLimitError,
    too_many: t.common.itemLimitError,
    too_large: t.common.valueLimitError,
  };
  const reason = overflows[String(err.body?.error)];
  if (reason) {
    const field = String(err.body?.field ?? "");
    const max = Number(err.body?.max ?? 0);
    return `${labels[field] ?? field}: ${reason} (${max}).`;
  }
  return t.common.error;
}
