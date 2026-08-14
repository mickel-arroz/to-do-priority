"use client";

import { Progress } from "@/components/ui/progress";
import { useT } from "@/lib/i18n/locale-context";

export function TodayProgress({ done, total }: { done: number; total: number }) {
  const t = useT();
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div
      className="flex items-center gap-3"
      data-testid="today-progress"
      aria-label={`${done}/${total} ${t.home.todayProgress}`}
    >
      <Progress value={percent} className="h-2 flex-1" />
      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
        {done}/{total}
      </span>
    </div>
  );
}
