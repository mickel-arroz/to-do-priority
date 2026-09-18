"use client";

import { format } from "date-fns";
import { enUS, es as esLocale } from "date-fns/locale";
import { CalendarDays } from "@/components/icons";
import { dueDayLabel } from "@/lib/due-date";
import { useLocale } from "@/lib/i18n/locale-context";
import { parseDate } from "@/lib/recurrence";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type TaskDueDateProps = {
  task: Task;
  /** The user's day, yyyy-MM-dd. */
  today: string;
};

/**
 * Due date of a pending task as shown in the list row and the card: the day
 * before, the user's day and the day after get a word instead of a date, and
 * an overdue task is marked as such.
 */
export function TaskDueDate({ task, today }: TaskDueDateProps) {
  const { locale, t } = useLocale();
  const isOverdue = task.due_date < today;
  const dateLocale = locale === "es" ? esLocale : enUS;

  return (
    <span
      className={cn(
        "flex items-center gap-1",
        isOverdue && "font-semibold text-failure"
      )}
    >
      <CalendarDays className="size-3.5" />
      {dueDayLabel(task.due_date, today, t) ??
        format(parseDate(task.due_date), "d MMM", { locale: dateLocale })}
      {isOverdue && ` · ${t.tasks.overdue}`}
    </span>
  );
}
