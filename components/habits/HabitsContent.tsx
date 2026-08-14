"use client";

import { useState } from "react";
import Link from "next/link";
import { Infinity as InfinityIcon, Plus, ShieldAlert } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HabitFormDialog } from "@/components/habits/HabitFormDialog";
import { HabitProgressBar } from "@/components/habits/HabitProgressBar";
import { StreakBadge } from "@/components/habits/StreakBadge";
import { computeHabitProgress } from "@/lib/habits";
import { useT } from "@/lib/i18n/locale-context";
import type { Habit, HabitLog, Task } from "@/lib/types";

type HabitsContentProps = {
  habits: Habit[];
  logs: HabitLog[];
  tasks: Task[];
  today: string;
};

export function HabitsContent({ habits, logs, tasks, today }: HabitsContentProps) {
  const t = useT();
  const [formOpen, setFormOpen] = useState(false);

  const logsByHabit = new Map<string, HabitLog[]>();
  for (const log of logs) {
    const list = logsByHabit.get(log.habit_id) ?? [];
    list.push(log);
    logsByHabit.set(log.habit_id, list);
  }

  return (
    <div className="space-y-6" data-testid="habits-page">
      <header className="glow-primary flex flex-wrap items-center justify-between gap-3">
        <h1 className="gradient-text min-w-0 flex-1 text-2xl font-bold">
          {t.habits.title}
        </h1>
        <Button onClick={() => setFormOpen(true)} data-testid="new-habit">
          <Plus className="size-4" />
          {t.habits.newHabit}
        </Button>
      </header>

      {habits.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          {t.habits.empty}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {habits.map((habit) => {
            const progress = computeHabitProgress(
              habit,
              logsByHabit.get(habit.id) ?? [],
              today
            );
            return (
              <Link key={habit.id} href={`/habits/${habit.id}`} className="group">
                <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">
                        {habit.name}
                      </CardTitle>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {progress.isIndefinite && (
                          <Badge variant="outline" className="gap-1">
                            <InfinityIcon className="size-3" />
                          </Badge>
                        )}
                        {habit.punishment_enabled && !progress.isIndefinite && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-failure/40 text-failure"
                            title={t.habits.punishmentHint}
                          >
                            <ShieldAlert className="size-3" />
                          </Badge>
                        )}
                        <StreakBadge streak={progress.currentStreak} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <HabitProgressBar progress={progress} />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <HabitFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tasks={tasks}
        today={today}
      />
    </div>
  );
}
