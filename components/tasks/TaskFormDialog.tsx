"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "@/components/icons";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PrioritySelect } from "@/components/tasks/PrioritySelect";
import {
  RecurrencePicker,
  type RecurrenceValue,
} from "@/components/tasks/RecurrencePicker";
import { api, type TaskInput } from "@/lib/api/client";
import { useT } from "@/lib/i18n/locale-context";
import type { Category, Priority, Task } from "@/lib/types";

type TaskFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  /** When set, the dialog edits instead of creating */
  task?: Task | null;
  defaultCategoryId?: string;
  today: string;
};

export function TaskFormDialog({
  open,
  onOpenChange,
  categories,
  task,
  defaultCategoryId,
  today,
}: TaskFormDialogProps) {
  const t = useT();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [link, setLink] = useState("");
  const [dueDate, setDueDate] = useState(today);
  const [priority, setPriority] = useState<Priority>(2);
  const [pomodoro, setPomodoro] = useState(0);
  const [recurrence, setRecurrence] = useState<RecurrenceValue>({
    type: "none",
    weekdays: [],
    interval: 1,
  });
  const [newSubtasks, setNewSubtasks] = useState<string[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Derived-state-during-render: repopulate the form whenever it opens
  const [prevKey, setPrevKey] = useState<string | null>(null);
  const openKey = open ? `${task?.id ?? "new"}-${defaultCategoryId ?? ""}` : null;
  if (openKey !== prevKey) {
    setPrevKey(openKey);
    if (openKey !== null) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setCategoryId(
        task?.category_id ??
          defaultCategoryId ??
          categories.find((c) => c.is_default)?.id ??
          categories[0]?.id ??
          ""
      );
      setLink(task?.link ?? "");
      setDueDate(task?.due_date ?? today);
      setPriority((task?.priority as Priority) ?? 2);
      setPomodoro(task?.pomodoro_minutes ?? 0);
      setRecurrence({
        type: task?.recurrence_type ?? "none",
        weekdays: task?.recurrence_weekdays ?? [],
        interval: task?.recurrence_interval ?? 1,
      });
      setNewSubtasks([]);
      setSubtaskDraft("");
    }
  }

  function addSubtask() {
    const draft = subtaskDraft.trim();
    if (!draft) return;
    setNewSubtasks((prev) => [...prev, draft]);
    setSubtaskDraft("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueDate || !categoryId) return;

    const input: TaskInput = {
      title: title.trim(),
      description: description.trim() || null,
      category_id: categoryId,
      link: link.trim() || null,
      due_date: dueDate,
      priority,
      pomodoro_minutes: pomodoro,
      recurrence_type: recurrence.type,
      recurrence_weekdays: recurrence.type === "daily" ? recurrence.weekdays : null,
      recurrence_interval: recurrence.interval,
      subtasks: newSubtasks.map((s) => ({ title: s })),
    };

    setSaving(true);
    try {
      if (task) {
        const rest = { ...input };
        delete rest.subtasks;
        await api.tasks.update(task.id, rest);
      } else {
        await api.tasks.create(input);
      }
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{task ? t.tasks.editTask : t.tasks.newTask}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">{t.tasks.title} *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              data-testid="task-title-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">
              {t.tasks.description}{" "}
              <span className="text-muted-foreground">({t.common.optional})</span>
            </Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Two-column layout on desktop, stacked on mobile */}
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            {/* Left column: core attributes */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t.tasks.category}</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger
                      data-testid="task-category-select"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.is_default ? t.categories.general : c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-due">{t.tasks.dueDate} *</Label>
                  <Input
                    id="task-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                    data-testid="task-due-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-link">
                  {t.tasks.link}{" "}
                  <span className="text-muted-foreground">
                    ({t.common.optional})
                  </span>
                </Label>
                <Input
                  id="task-link"
                  type="url"
                  placeholder="https://"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t.tasks.recurrence}</Label>
                <RecurrencePicker value={recurrence} onChange={setRecurrence} />
              </div>
            </div>

            {/* Right column: priority & productivity */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t.tasks.priority}</Label>
                <PrioritySelect value={priority} onChange={setPriority} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-pomodoro">{t.tasks.pomodoro}</Label>
                <Input
                  id="task-pomodoro"
                  type="number"
                  min={0}
                  max={180}
                  placeholder="0"
                  value={pomodoro === 0 ? "" : pomodoro}
                  onChange={(e) =>
                    setPomodoro(
                      Math.min(180, Math.max(0, Number(e.target.value) || 0))
                    )
                  }
                />
              </div>
            </div>
          </div>

          {!task && (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="task-subtask">{t.tasks.subtasks}</Label>
              {newSubtasks.length > 0 && (
                <ul className="space-y-1">
                  {newSubtasks.map((s, i) => (
                    <li
                      key={`${s}-${i}`}
                      className="flex items-center justify-between rounded-lg bg-muted px-3 py-1.5 text-sm"
                    >
                      <span className="truncate">{s}</span>
                      <button
                        type="button"
                        aria-label={t.common.delete}
                        onClick={() =>
                          setNewSubtasks((prev) => prev.filter((_, j) => j !== i))
                        }
                      >
                        <X className="size-4 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  id="task-subtask"
                  value={subtaskDraft}
                  onChange={(e) => setSubtaskDraft(e.target.value)}
                  placeholder={t.tasks.addSubtask}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSubtask();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="icon" onClick={addSubtask}>
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <LoadingButton
              type="submit"
              loading={saving}
              disabled={!title.trim()}
              data-testid="task-save"
            >
              {t.common.save}
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
