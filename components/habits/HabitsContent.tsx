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
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
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
      <PageHeader
        title={t.habits.title}
        actions={
          <Button onClick={() => setFormOpen(true)} data-testid="new-habit">
            <Plus className="size-4" />
            {t.habits.newHabit}
          </Button>
        }
      />

      {habits.length === 0 ? (
        <EmptyState className="rounded-xl py-12">{t.habits.empty}</EmptyState>
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
