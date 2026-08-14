"use client";

import { Infinity as InfinityIcon } from "@/components/icons";
import { Progress } from "@/components/ui/progress";
import type { HabitProgress } from "@/lib/habits";
import { useT } from "@/lib/i18n/locale-context";

export function HabitProgressBar({ progress }: { progress: HabitProgress }) {
  const t = useT();

  if (progress.isIndefinite) {
    return (
      <div
        className="flex items-center gap-2 text-sm text-muted-foreground"
        data-testid="habit-progress"
      >
        <InfinityIcon className="size-4" />
        <span>
          {progress.completedDays} {t.habits.days} · {t.habits.goalIndefinite}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1" data-testid="habit-progress">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">
          {progress.progress} {t.habits.daysOf} {progress.target}
        </span>
        <span className="font-semibold tabular-nums">{progress.percent}%</span>
      </div>
      <Progress value={progress.percent ?? 0} className="h-2.5" />
    </div>
  );
}
