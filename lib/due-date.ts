import { addDays } from "date-fns";
import type { Dictionary } from "@/lib/i18n";
import { formatDate, parseDate } from "@/lib/recurrence";

/**
 * Names a due date relative to the user's day ("Ayer", "Hoy", "Mañana"), or
 * returns `null` when it is far enough away that the caller should show the
 * plain date instead. Both dates are yyyy-MM-dd strings to avoid timezone
 * drift; `today` is the user's day, never the server's.
 */
export function dueDayLabel(
  dueDate: string,
  today: string,
  t: Dictionary
): string | null {
  if (dueDate === today) return t.tasks.today;

  const day = parseDate(today);
  if (dueDate === formatDate(addDays(day, -1))) return t.tasks.yesterday;
  if (dueDate === formatDate(addDays(day, 1))) return t.tasks.tomorrow;

  return null;
}
