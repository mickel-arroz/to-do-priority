"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, ShieldAlert, Trash2 } from "@/components/icons";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent } from "@/components/ui/card";
import { DailyAdvice } from "@/components/advice/DailyAdvice";
import { HabitCalendar } from "@/components/habits/HabitCalendar";
import { HabitCharts } from "@/components/habits/HabitCharts";
import { HabitFormDialog } from "@/components/habits/HabitFormDialog";
import { HabitProgressBar } from "@/components/habits/HabitProgressBar";
import { StreakBadge } from "@/components/habits/StreakBadge";
import type { Bilingual } from "@/lib/advice";
import { api } from "@/lib/api/client";
import { computeHabitProgress } from "@/lib/habits";
import { useT } from "@/lib/i18n/locale-context";
import { priorityClasses } from "@/lib/priority";
import type { Habit, HabitLog, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type HabitDetailContentProps = {
  habit: Habit;
  initialLogs: HabitLog[];
  linkedTasks: Task[];
  /** All pending tasks, for the edit dialog */
  allTasks: Task[];
  today: string;
  dayOfYear: number;
  /** Consejo de este hábito, o null si todavía no hay ninguno generado. */
  advice: Bilingual | null;
};

export function HabitDetailContent({
  habit,
  initialLogs,
  linkedTasks,
  allTasks,
  today,
  dayOfYear,
  advice,
}: HabitDetailContentProps) {
  const t = useT();
  const router = useRouter();
  const [logs, setLogs] = useState(initialLogs);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Backfill 'missed' days so the calendar shows them; progress math
  // derives everything from raw logs regardless
  useEffect(() => {
    api.habits
      .syncMissed(habit.id)
      .then(({ logs: synced }) => setLogs(synced))
      .catch(() => {});
  }, [habit.id]);

  const progress = computeHabitProgress(habit, logs, today);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.habits.remove(habit.id);
      router.push("/habits");
      router.refresh();
    } catch {
      toast.error(t.common.error);
      setDeleting(false);
    }
  }

  const metrics: { label: string; value: string | number }[] = [
    { label: t.habits.completedDays, value: progress.completedDays },
    { label: t.habits.missedDays, value: progress.missedDays },
    { label: t.habits.currentStreak, value: progress.currentStreak },
    { label: t.habits.bestStreak, value: progress.bestStreak },
    { label: t.habits.completionRate, value: `${progress.completionRate}%` },
  ];

  return (
    <div className="space-y-6" data-testid="habit-detail">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="gradient-text text-3xl font-bold">{habit.name}</h1>
            <StreakBadge streak={progress.currentStreak} size="lg" />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t.common.edit}
              onClick={() => setEditOpen(true)}
              data-testid="edit-habit"
            >
              <Pencil className="size-4" />
            </Button>
            <AlertDialog
              open={confirmOpen}
              onOpenChange={(o) => {
                if (deleting) return;
                setConfirmOpen(o);
              }}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t.habits.deleteHabit}
                  className="text-destructive hover:text-destructive"
                  data-testid="delete-habit"
                >
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent
                onEscapeKeyDown={(e) => deleting && e.preventDefault()}
              >
                <AlertDialogHeader>
                  <AlertDialogTitle>{t.habits.deleteHabit}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t.habits.deleteHabitConfirm}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>
                    {t.common.cancel}
                  </AlertDialogCancel>
                  <LoadingButton
                    variant="destructive"
                    loading={deleting}
                    onClick={handleDelete}
                  >
                    {t.common.delete}
                  </LoadingButton>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        {habit.description && (
          <p className="text-sm text-muted-foreground">{habit.description}</p>
        )}
        {habit.punishment_enabled && !progress.isIndefinite && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-failure">
            <ShieldAlert className="size-3.5" />
            {t.habits.punishmentHint}
          </p>
        )}
        <HabitProgressBar progress={progress} />
      </header>

      <DailyAdvice advice={advice} dayOfYear={dayOfYear} habitId={habit.id} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {metrics.map((m) => (
          <Card key={m.label} className="gradient-card py-0">
            <CardContent className="p-4 text-center">
              <p className="font-heading text-xl font-bold">{m.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card>
          <CardContent className="p-4">
            <HabitCalendar habit={habit} logs={logs} today={today} />
          </CardContent>
        </Card>

        <div className="space-y-2">
          <p className="font-heading font-semibold">{t.habits.linkedTasks}</p>
          <ul className="space-y-1.5">
            {linkedTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm"
              >
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    priorityClasses[task.priority].dot
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {task.due_date}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <HabitCharts habit={habit} logs={logs} today={today} />

      <HabitFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tasks={allTasks}
        habit={habit}
        today={today}
      />
    </div>
  );
}
