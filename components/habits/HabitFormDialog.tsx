"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, type HabitInput } from "@/lib/api/client";
import { useT } from "@/lib/i18n/locale-context";
import { priorityClasses } from "@/lib/priority";
import type { Habit, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type GoalMode = "days" | "date" | "indefinite";

type HabitFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pending tasks available to link */
  tasks: Task[];
  habit?: Habit | null;
  today: string;
};

export function HabitFormDialog({
  open,
  onOpenChange,
  tasks,
  habit,
  today,
}: HabitFormDialogProps) {
  const t = useT();
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goalMode, setGoalMode] = useState<GoalMode>("days");
  const [targetDays, setTargetDays] = useState(30);
  const [endDate, setEndDate] = useState("");
  const [punishment, setPunishment] = useState(false);
  const [taskIds, setTaskIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Derived-state-during-render: repopulate the form whenever it opens
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName(habit?.name ?? "");
      setDescription(habit?.description ?? "");
      setGoalMode(
        habit
          ? habit.target_days !== null
            ? "days"
            : habit.end_date !== null
              ? "date"
              : "indefinite"
          : "days"
      );
      setTargetDays(habit?.target_days ?? 30);
      setEndDate(habit?.end_date ?? "");
      setPunishment(habit?.punishment_enabled ?? false);
      setTaskIds(new Set(habit?.habit_tasks?.map((ht) => ht.task_id) ?? []));
    }
  }

  const isIndefinite = goalMode === "indefinite";

  function toggleTask(id: string) {
    setTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || taskIds.size === 0) return;
    if (goalMode === "date" && !endDate) return;

    const input: HabitInput = {
      name: name.trim(),
      description: description.trim() || null,
      target_days: goalMode === "days" ? targetDays : null,
      end_date: goalMode === "date" ? endDate : null,
      punishment_enabled: isIndefinite ? false : punishment,
      task_ids: [...taskIds],
    };

    setSaving(true);
    try {
      if (habit) await api.habits.update(habit.id, input);
      else await api.habits.create({ ...input, start_date: today });
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(t.common.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{habit ? t.habits.editHabit : t.habits.newHabit}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="habit-name">{t.habits.name} *</Label>
            <Input
              id="habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              data-testid="habit-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="habit-description">
              {t.habits.description}{" "}
              <span className="text-muted-foreground">({t.common.optional})</span>
            </Label>
            <Textarea
              id="habit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>{t.habits.goalType}</Label>
            <Tabs value={goalMode} onValueChange={(v) => setGoalMode(v as GoalMode)}>
              <TabsList className="w-full">
                <TabsTrigger value="days" className="flex-1" data-testid="goal-days">
                  {t.habits.goalDays}
                </TabsTrigger>
                <TabsTrigger value="date" className="flex-1" data-testid="goal-date">
                  {t.habits.goalDate}
                </TabsTrigger>
                <TabsTrigger
                  value="indefinite"
                  className="flex-1"
                  data-testid="goal-indefinite"
                >
                  {t.habits.goalIndefinite}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {goalMode === "days" && (
              <Input
                type="number"
                min={1}
                max={3650}
                value={targetDays}
                onChange={(e) =>
                  setTargetDays(Math.max(1, Number(e.target.value) || 1))
                }
                data-testid="target-days-input"
              />
            )}
            {goalMode === "date" && (
              <Input
                type="date"
                min={today}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                data-testid="end-date-input"
              />
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div className="pr-3">
              <p className="text-sm font-medium">{t.habits.punishment}</p>
              <p className="text-xs text-muted-foreground">
                {isIndefinite ? t.habits.punishmentNotAvailable : t.habits.punishmentHint}
              </p>
            </div>
            <Switch
              checked={!isIndefinite && punishment}
              onCheckedChange={setPunishment}
              disabled={isIndefinite}
              data-testid="punishment-switch"
            />
          </div>

          <div className="space-y-2">
            <Label>{t.habits.linkedTasks} *</Label>
            <p className="text-xs text-muted-foreground">{t.habits.linkedTasksHint}</p>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border p-2">
              {tasks.length === 0 && (
                <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                  {t.home.emptyList}
                </p>
              )}
              {tasks.map((task) => (
                <label
                  key={task.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={taskIds.has(task.id)}
                    onChange={() => toggleTask(task.id)}
                    className="size-4 accent-primary"
                    data-testid={`link-task-${task.id}`}
                  />
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      priorityClasses[task.priority].dot
                    )}
                  />
                  <span className="truncate">{task.title}</span>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <LoadingButton
              type="submit"
              loading={saving}
              disabled={!name.trim() || taskIds.size === 0}
              data-testid="habit-save"
            >
              {t.common.save}
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
