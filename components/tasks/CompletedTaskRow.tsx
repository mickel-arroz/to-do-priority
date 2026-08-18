"use client";

import { format } from "date-fns";
import { enUS, es as esLocale } from "date-fns/locale";
import {
  CalendarDays,
  Check,
  Link2,
  ListChecks,
  RotateCcw,
  X,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { PriorityTag } from "@/components/tasks/PriorityTag";
import { useTaskBoard } from "@/components/tasks/TaskBoard";
import { useLocale } from "@/lib/i18n/locale-context";
import { priorityClasses } from "@/lib/priority";
import { parseDate } from "@/lib/recurrence";
import type { CompletedTask, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type CompletedTaskRowProps = {
  task: Task | CompletedTask;
  /** Show the list the task belongs to (Home completed section) */
  showCategory?: boolean;
};

/**
 * Completed task row. Mirrors the pending TaskRow layout (checkbox · title ·
 * priority tag + due date) so both look the same — the only difference is the
 * struck-through, muted title. The checkbox opens a menu to switch yes/no or
 * revive it to pending (mis-swipes happen).
 */
export function CompletedTaskRow({
  task,
  showCategory = false,
}: CompletedTaskRowProps) {
  const { locale, t } = useLocale();
  const board = useTaskBoard();
  const dateLocale = locale === "es" ? esLocale : enUS;
  const categories = "categories" in task ? task.categories : null;
  const p = priorityClasses[task.priority];

  const doneSubtasks = task.subtasks?.filter((s) => s.is_done).length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;

  function changeStatus(status: "pending" | "yes" | "no") {
    if (status === task.status) return;
    // Optimistic move handled by the board: the row switches section instantly
    board.changeTaskStatus(task as Task, status);
  }

  return (
    <div
      data-testid={`completed-row-${task.id}`}
      className="relative flex items-center gap-3 rounded-lg border bg-muted py-3 pl-4 pr-3 text-muted-foreground"
    >
      {/* Priority side bar, dimmed to keep the completed row muted */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1.5 rounded-l-lg opacity-50",
          p.bar
        )}
        aria-hidden
      />

      {/* Checkbox (checked): opens the status menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={t.tasks.changeStatus}
            data-testid="status-button"
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md text-on-strong transition-transform hover:scale-110",
              task.status === "yes" ? "bg-success" : "bg-failure"
            )}
            title={t.tasks.changeStatus}
          >
            {task.status === "yes" ? (
              <Check className="size-3.5" />
            ) : (
              <X className="size-3.5" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{t.tasks.changeStatus}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={task.status === "yes"}
            onClick={() => changeStatus("yes")}
            data-testid="status-yes"
          >
            <Check className="size-4 text-success" />
            {t.tasks.completedYes}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={task.status === "no"}
            onClick={() => changeStatus("no")}
            data-testid="status-no"
          >
            <X className="size-4 text-failure" />
            {t.tasks.completedNo}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => changeStatus("pending")}
            data-testid="status-pending"
          >
            <RotateCcw className="size-4" />
            {t.tasks.markPending}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium line-through decoration-muted-foreground/40">
          {task.title}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <PriorityTag priority={task.priority} className="opacity-70" />
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

      {showCategory && categories && (
        <Badge
          variant="outline"
          className="shrink-0 gap-1"
          style={categories.color ? { color: categories.color } : undefined}
        >
          <CategoryIcon icon={categories.icon} className="size-3" />
          {categories.is_default ? t.categories.general : categories.name}
        </Badge>
      )}
      {task.completed_at && (
        <span className="shrink-0 text-xs tabular-nums">
          {format(new Date(task.completed_at), "d MMM HH:mm", {
            locale: dateLocale,
          })}
        </span>
      )}
    </div>
  );
}
