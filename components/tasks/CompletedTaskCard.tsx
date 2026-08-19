"use client";

import { format } from "date-fns";
import { enUS, es as esLocale } from "date-fns/locale";
import { CalendarDays, Link2, ListChecks } from "@/components/icons";
import { CompletedStatusMenu } from "@/components/tasks/CompletedStatusMenu";
import { PriorityTag } from "@/components/tasks/PriorityTag";
import { useLocale } from "@/lib/i18n/locale-context";
import { priorityClasses } from "@/lib/priority";
import { parseDate } from "@/lib/recurrence";
import type { CompletedTask, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Card representation of a completed task for the Home "Pending" grid view.
 * Mirrors TaskCard's shell (top priority accent, stacked layout) but muted and
 * struck-through, and reuses CompletedStatusMenu so the same yes/no/revive
 * actions as the list row are available in cards view.
 */
export function CompletedTaskCard({ task }: { task: Task | CompletedTask }) {
  const { locale } = useLocale();
  const dateLocale = locale === "es" ? esLocale : enUS;
  const p = priorityClasses[task.priority];

  const doneSubtasks = task.subtasks?.filter((s) => s.is_done).length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;

  return (
    <div
      data-testid={`completed-card-${task.id}`}
      className="relative flex h-full flex-col gap-2 overflow-hidden rounded-lg border bg-muted p-3 text-muted-foreground shadow-sm"
    >
      <div
        className={cn("absolute inset-x-0 top-0 h-1 opacity-50", p.bar)}
        aria-hidden
      />

      <div className="flex items-center gap-2 pt-1">
        <CompletedStatusMenu task={task} />
        <PriorityTag priority={task.priority} className="opacity-70" />
      </div>

      <span className="line-clamp-2 text-sm font-medium line-through decoration-muted-foreground/40">
        {task.title}
      </span>

      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarDays className="size-3.5" />
          {format(parseDate(task.due_date), "d MMM", { locale: dateLocale })}
        </span>
        {totalSubtasks > 0 && (
          <span className="flex items-center gap-1">
            <ListChecks className="size-3.5" />
            {doneSubtasks}/{totalSubtasks}
          </span>
        )}
        {task.link && <Link2 className="size-3.5" />}
      </span>
    </div>
  );
}
