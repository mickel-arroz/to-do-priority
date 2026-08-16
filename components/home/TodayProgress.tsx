"use client";

import { useT } from "@/lib/i18n/locale-context";

export function TodayProgress({
  success,
  failure,
  total,
}: {
  /** Tasks completed as achieved (status "yes") */
  success: number;
  /** Tasks completed as not achieved (status "no") */
  failure: number;
  /** Total = completed (success + failure) + still pending */
  total: number;
}) {
  const t = useT();
  const done = success + failure;
  const successPct = total === 0 ? 0 : (success / total) * 100;
  const failurePct = total === 0 ? 0 : (failure / total) * 100;

  return (
    <div
      className="flex items-center gap-3"
      data-testid="today-progress"
      aria-label={`${done}/${total} ${t.home.todayProgress}`}
    >
      <div className="relative flex h-2 flex-1 items-center overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-success transition-all"
          style={{ width: `${successPct}%` }}
        />
        <div
          className="h-full bg-failure transition-all"
          style={{ width: `${failurePct}%` }}
        />
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
        {done}/{total}
      </span>
    </div>
  );
}
