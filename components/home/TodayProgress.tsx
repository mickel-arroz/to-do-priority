"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

export function TodayProgress({
  success,
  failure,
  pending,
}: {
  /** Tasks completed as achieved (status "yes") */
  success: number;
  /** Tasks completed as not achieved (status "no") */
  failure: number;
  /** Tasks due up to the user's day still open (overdue included, upcoming not) */
  pending: number;
}) {
  const t = useT();
  const done = success + failure;
  const total = done + pending;
  const segments = [
    {
      state: "success",
      count: success,
      label: t.home.progressCompleted(success),
      color: "bg-success",
    },
    {
      state: "failure",
      count: failure,
      label: t.home.progressFailed(failure),
      color: "bg-failure",
    },
    {
      state: "pending",
      count: pending,
      label: t.home.progressPending(pending),
      color: "bg-muted",
    },
  ];

  return (
    <div
      className="flex items-center gap-3"
      data-testid="today-progress"
      aria-label={`${done}/${total} ${t.home.todayProgress}`}
    >
      <div className="relative flex h-2 flex-1 items-center overflow-hidden rounded-full bg-muted">
        {segments
          .filter(({ count }) => count > 0)
          .map(({ state, count, label, color }) => (
            <Tooltip key={state}>
              <TooltipTrigger asChild>
                <span
                  role="img"
                  tabIndex={0}
                  aria-label={label}
                  data-testid={`today-progress-${state}`}
                  className={cn(
                    "h-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    color
                  )}
                  style={{ width: `${(count / total) * 100}%` }}
                />
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
        {done}/{total}
      </span>
    </div>
  );
}
