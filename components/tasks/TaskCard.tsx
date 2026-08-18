"use client";

import { format } from "date-fns";
import { enUS, es as esLocale } from "date-fns/locale";
import { CalendarDays, Link2, ListChecks, Timer } from "@/components/icons";
import { PriorityTag } from "@/components/tasks/PriorityTag";
import { TaskCompleteCheckbox } from "@/components/tasks/TaskCompleteCheckbox";
import { priorityClasses } from "@/lib/priority";
import { parseDate } from "@/lib/recurrence";
import { useLocale } from "@/lib/i18n/locale-context";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type TaskCardProps = {
  task: Task;
  today: string;
  onComplete: (task: Task, status: "yes" | "no") => void;
  onOpenPomodoro: (task: Task) => void;
  onOpenDetail: (task: Task) => void;
};

/**
 * Card representation of a task for the Home "Pending" grid view: a compact
 * rectangle with the same actions as the list row (checkbox menu, pomodoro,
 * open detail) but stacked vertically.
 */
export function TaskCard({
  task,
  today,
  onComplete,
  onOpenPomodoro,
  onOpenDetail,
}: TaskCardProps) {
  const { locale, t } = useLocale();
  const p = priorityClasses[task.priority];
  const isOverdue = task.due_date < today;
  const isToday = task.due_date === today;
  const dateLocale = locale === "es" ? esLocale : enUS;

  const doneSubtasks = task.subtasks?.filter((s) => s.is_done).length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;

  return (
    <div
      data-testid={`task-card-${task.id}`}
      className={cn(
        "relative flex h-full flex-col gap-2 overflow-hidden rounded-lg border bg-card p-3 shadow-sm transition-colors",
        p.soft,
        p.ring
      )}
    >
      {/* Priority accent bar along the top edge */}
      <div className={cn("absolute inset-x-0 top-0 h-1", p.bar)} aria-hidden />

      <div className="flex items-center gap-2 pt-1">
        <TaskCompleteCheckbox task={task} onComplete={onComplete} />
        <PriorityTag priority={task.priority} />
        {task.pomodoro_minutes > 0 && (
          <button
            onClick={() => onOpenPomodoro(task)}
            aria-label={t.pomodoro.title}
            className="ml-auto shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
            data-testid="pomodoro-button"
          >
            <Timer className="size-4" />
          </button>
        )}
      </div>

      <button
        className="min-w-0 flex-1 text-left"
        onClick={() => onOpenDetail(task)}
        data-testid="task-title"
      >
        <span className="line-clamp-2 text-sm font-medium">{task.title}</span>
      </button>

      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span
          className={cn(
            "flex items-center gap-1",
            isOverdue && "font-semibold text-failure"
          )}
        >
          <CalendarDays className="size-3.5" />
          {isToday
            ? t.tasks.today
            : format(parseDate(task.due_date), "d MMM", { locale: dateLocale })}
          {isOverdue && ` · ${t.tasks.overdue}`}
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
