"use client";

import { Check, RotateCcw, X } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTaskBoard } from "@/components/tasks/TaskBoard";
import { useT } from "@/lib/i18n/locale-context";
import type { CompletedTask, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Checkbox (checked) that opens the status menu of an already-completed task:
 * switch yes/no or revive it back to pending (mis-swipes happen). Shared by the
 * list row and the card view so both behave identically.
 */
export function CompletedStatusMenu({
  task,
  className,
}: {
  task: Task | CompletedTask;
  className?: string;
}) {
  const t = useT();
  const board = useTaskBoard();

  function changeStatus(status: "pending" | "yes" | "no") {
    if (status === task.status) return;
    board.changeTaskStatus(task as Task, status);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t.tasks.changeStatus}
          data-testid="status-button"
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md text-on-strong transition-transform hover:scale-110",
            task.status === "yes" ? "bg-success" : "bg-failure",
            className
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
  );
}
