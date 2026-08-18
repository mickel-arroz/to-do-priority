"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays } from "date-fns";
import { toast } from "sonner";
import { Loader2 } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormFieldset, useLockedOpenChange } from "@/components/ui/busy";
import { CharCounter } from "@/components/ui/char-counter";
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
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, type HabitInput } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/error-message";
import { useT } from "@/lib/i18n/locale-context";
import { LIMITS } from "@/lib/limits";
import { priorityClasses } from "@/lib/priority";
import { formatDate, parseDate } from "@/lib/recurrence";
import type { Habit, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type GoalMode = "days" | "date" | "indefinite";

const PAGE_SIZE = 50;

type HabitFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pending tasks available to link (seed for the first page) */
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

  const defaultEndDate = formatDate(addDays(parseDate(today), 30));

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goalMode, setGoalMode] = useState<GoalMode>("days");
  const [targetDays, setTargetDays] = useState(30);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [punishment, setPunishment] = useState(false);
  const [taskIds, setTaskIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Task search + lazy loading (backend-driven)
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Task[]>(tasks);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

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
      setEndDate(habit?.end_date ?? defaultEndDate);
      setPunishment(habit?.punishment_enabled ?? false);
      setTaskIds(new Set(habit?.habit_tasks?.map((ht) => ht.task_id) ?? []));
      setSearch("");
      setResults(tasks);
      setOffset(0);
      setHasMore(false);
    }
  }

  const isIndefinite = goalMode === "indefinite";
  const nameOver = name.length > LIMITS.habitName;
  const descriptionOver = description.length > LIMITS.habitDescription;
  const hasOverflow = nameOver || descriptionOver;

  const fetchPage = useCallback(
    async (q: string, from: number, replace: boolean) => {
      setLoading(true);
      try {
        const res = await api.tasks.list({
          q: q || undefined,
          limit: PAGE_SIZE,
          offset: from,
        });
        setResults((prev) => (replace ? res.tasks : [...prev, ...res.tasks]));
        setHasMore(res.hasMore ?? false);
        setOffset(from + res.tasks.length);
      } catch (err) {
        toast.error(apiErrorMessage(err, t));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  // Initial load + debounced search (only while the dialog is open)
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => fetchPage(search, 0, true), search ? 300 : 0);
    return () => clearTimeout(id);
  }, [open, search, fetchPage]);

  function handleScroll() {
    const el = listRef.current;
    if (!el || loading || !hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      fetchPage(search, offset, false);
    }
  }

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
    if (!name.trim() || taskIds.size === 0 || hasOverflow) return;
    if (goalMode === "date" && (!endDate || endDate <= today)) return;

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
    } catch (err) {
      toast.error(apiErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  }

  const handleOpenChange = useLockedOpenChange(saving, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
        showCloseButton={!saving}
      >
        <DialogHeader>
          <DialogTitle>{habit ? t.habits.editHabit : t.habits.newHabit}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FormFieldset busy={saving} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="habit-name">{t.habits.name} *</Label>
              <CharCounter length={name.length} max={LIMITS.habitName} />
            </div>
            <Input
              id="habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-invalid={nameOver}
              data-testid="habit-name-input"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="habit-description">
                {t.habits.description}{" "}
                <span className="text-muted-foreground">
                  ({t.common.optional})
                </span>
              </Label>
              <CharCounter
                length={description.length}
                max={LIMITS.habitDescription}
              />
            </div>
            <Textarea
              id="habit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              aria-invalid={descriptionOver}
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
              <NumberInput
                min={1}
                max={3650}
                value={targetDays}
                onChange={setTargetDays}
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
            <div className="flex items-center justify-between gap-2">
              <Label>{t.habits.linkedTasks} *</Label>
              {taskIds.size > 0 && (
                <span className="text-xs text-muted-foreground">
                  {taskIds.size}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t.habits.linkedTasksHint}</p>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.common.search}
              data-testid="task-search-input"
            />
            <div
              ref={listRef}
              onScroll={handleScroll}
              className="max-h-44 space-y-1 overflow-y-auto rounded-xl border p-2"
            >
              {results.length === 0 && !loading && (
                <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                  {search ? t.common.noResults : t.home.emptyList}
                </p>
              )}
              {results.map((task) => (
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
              {loading && (
                <div
                  className="flex items-center justify-center py-3"
                  data-testid="task-search-loading"
                >
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <LoadingButton
              type="submit"
              loading={saving}
              disabled={!name.trim() || taskIds.size === 0 || hasOverflow}
              data-testid="habit-save"
            >
              {t.common.save}
            </LoadingButton>
          </DialogFooter>
          </FormFieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
