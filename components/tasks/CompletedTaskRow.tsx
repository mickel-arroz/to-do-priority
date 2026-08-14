"use client";

import { format } from "date-fns";
import { enUS, es as esLocale } from "date-fns/locale";
import { Check, RotateCcw, X } from "@/components/icons";
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
import { useTaskBoard } from "@/components/tasks/TaskBoard";
import { useLocale } from "@/lib/i18n/locale-context";
import { priorityClasses } from "@/lib/priority";
import type { CompletedTask, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type CompletedTaskRowProps = {
  task: Task | CompletedTask;
  /** Show the list the task belongs to (Home completed section) */
  showCategory?: boolean;
};

/**
 * Muted row for a completed task. The status icon opens a menu to edit the
 * status: switch yes/no or unmark it back to pending (mis-swipes happen).
 */
export function CompletedTaskRow({
  task,
  showCategory = false,
}: CompletedTaskRowProps) {
  const { locale, t } = useLocale();
  const board = useTaskBoard();
  const dateLocale = locale === "es" ? esLocale : enUS;
  const categories = "categories" in task ? task.categories : null;

  function changeStatus(status: "pending" | "yes" | "no") {
    if (status === task.status) return;
    // Optimistic move handled by the board: the row switches section instantly
    board.changeTaskStatus(task as Task, status);
  }

  return (
    <div
      data-testid={`completed-row-${task.id}`}
      className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={t.tasks.changeStatus}
            data-testid="status-button"
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md text-on-strong transition-transform hover:scale-110 disabled:opacity-50",
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

      <span
        className={cn(
          "size-2 shrink-0 rounded-full opacity-60",
          priorityClasses[task.priority].dot
        )}
        title={`P${task.priority}`}
      />
      <span className="min-w-0 flex-1 truncate line-through decoration-muted-foreground/40">
        {task.title}
      </span>
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
