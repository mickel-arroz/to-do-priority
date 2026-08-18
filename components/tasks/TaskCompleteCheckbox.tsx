"use client";

import { Check, X } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n/locale-context";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Empty checkbox that opens a menu to mark a pending task done or failed.
 * Shared by the list row and the card view so both behave identically.
 */
export function TaskCompleteCheckbox({
  task,
  onComplete,
  className,
}: {
  task: Task;
  onComplete: (task: Task, status: "yes" | "no") => void;
  className?: string;
}) {
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={t.tasks.changeStatus}
          data-testid="status-button"
          title={t.tasks.changeStatus}
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-muted-foreground/40 text-transparent transition-colors hover:border-primary hover:text-primary",
            className
          )}
        >
          <Check className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{t.tasks.changeStatus}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onComplete(task, "yes")}
          data-testid="status-yes"
        >
          <Check className="size-4 text-success" />
          {t.tasks.completedYes}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onComplete(task, "no")}
          data-testid="status-no"
        >
          <X className="size-4 text-failure" />
          {t.tasks.completedNo}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
