import { ApiError } from "@/lib/api/client";
import type { Dictionary } from "@/lib/i18n";

/**
 * Human-readable message for a caught API error. Codes the backend raises on
 * purpose get their own message, so the user sees a specific reason instead of
 * the generic fallback: `too_long` names the field and its maximum, and
 * `subtask_limit_reached` says the task is full.
 */
export function apiErrorMessage(err: unknown, t: Dictionary): string {
  if (err instanceof ApiError && err.body?.error === "subtask_limit_reached") {
    return t.tasks.subtaskLimitReached;
  }
  if (err instanceof ApiError && err.body?.error === "too_long") {
    const field = String(err.body.field ?? "");
    const max = Number(err.body.max ?? 0);
    const labels: Record<string, string> = {
      title: t.tasks.title,
      description: t.tasks.description,
      subtask: t.tasks.subtasks,
      name: t.habits.name,
    };
    const label = labels[field] ?? field;
    return `${label}: ${t.tasks.charLimitError} (${max}).`;
  }
  return t.common.error;
}
