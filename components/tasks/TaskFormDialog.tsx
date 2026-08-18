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
import { CharCounter } from "@/components/ui/char-counter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
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
import { apiErrorMessage } from "@/lib/api/error-message";
import { useT } from "@/lib/i18n/locale-context";
import { LIMITS } from "@/lib/limits";
import type { Category, Priority, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Live character-limit checks: block submit while any field overflows, but
  // still let the user keep typing (fields turn red via aria-invalid).
  const titleOver = title.length > LIMITS.taskTitle;
  const descriptionOver = description.length > LIMITS.taskDescription;
  const subtaskDraftOver = subtaskDraft.length > LIMITS.subtaskTitle;
  const subtasksOver =
    newSubtasks.some((s) => s.length > LIMITS.subtaskTitle) ||
    (editingIndex !== null && editingValue.length > LIMITS.subtaskTitle);
  const hasOverflow =
    titleOver || descriptionOver || subtaskDraftOver || subtasksOver;

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
      setEditingIndex(null);
      setEditingValue("");
    }
  }

  function addSubtask() {
    const draft = subtaskDraft.trim();
    if (!draft || draft.length > LIMITS.subtaskTitle) return;
    setNewSubtasks((prev) => [...prev, draft]);
    setSubtaskDraft("");
  }

  function startEdit(index: number) {
    setEditingIndex(index);
    setEditingValue(newSubtasks[index]);
  }

  function commitEdit() {
    if (editingIndex === null) return;
    const v = editingValue.trim();
    setNewSubtasks((prev) =>
      v
        ? prev.map((s, j) => (j === editingIndex ? v : s))
        : prev.filter((_, j) => j !== editingIndex)
    );
    setEditingIndex(null);
    setEditingValue("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueDate || !categoryId || hasOverflow) return;

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
    } catch (err) {
      toast.error(apiErrorMessage(err, t));
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
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="task-title">{t.tasks.title} *</Label>
              <CharCounter length={title.length} max={LIMITS.taskTitle} />
            </div>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              aria-invalid={titleOver}
              data-testid="task-title-input"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="task-description">
                {t.tasks.description}{" "}
                <span className="text-muted-foreground">
                  ({t.common.optional})
                </span>
              </Label>
              <CharCounter
                length={description.length}
                max={LIMITS.taskDescription}
              />
            </div>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              aria-invalid={descriptionOver}
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
                <NumberInput
                  id="task-pomodoro"
                  min={0}
                  max={180}
                  placeholder="0"
                  value={pomodoro}
                  onChange={setPomodoro}
                />
              </div>
            </div>
          </div>

          {!task && (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="task-subtask">{t.tasks.subtasks}</Label>
              {newSubtasks.length > 0 && (
                <ul className="space-y-1">
                  {newSubtasks.map((s, i) => {
                    const editing = editingIndex === i;
                    return (
                      <li
                        key={i}
                        className="flex items-start gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm"
                      >
                        {editing ? (
                          <Input
                            autoFocus
                            value={editingValue}
                            aria-invalid={
                              editingValue.length > LIMITS.subtaskTitle
                            }
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitEdit();
                              } else if (e.key === "Escape") {
                                setEditingIndex(null);
                                setEditingValue("");
                              }
                            }}
                            className="h-7"
                            data-testid={`subtask-edit-${i}`}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(i)}
                            className={cn(
                              "min-w-0 flex-1 whitespace-normal break-words text-left",
                              s.length > LIMITS.subtaskTitle && "text-failure"
                            )}
                            title={t.common.edit}
                          >
                            {s}
                          </button>
                        )}
                        {!editing && (
                          <button
                            type="button"
                            aria-label={t.common.delete}
                            className="mt-0.5 shrink-0"
                            onClick={() =>
                              setNewSubtasks((prev) =>
                                prev.filter((_, j) => j !== i)
                              )
                            }
                          >
                            <X className="size-4 text-muted-foreground" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex items-center justify-end">
                <CharCounter
                  length={subtaskDraft.length}
                  max={LIMITS.subtaskTitle}
                />
              </div>
              <div className="flex gap-2">
                <Input
                  id="task-subtask"
                  value={subtaskDraft}
                  onChange={(e) => setSubtaskDraft(e.target.value)}
                  placeholder={t.tasks.addSubtask}
                  aria-invalid={subtaskDraftOver}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSubtask();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addSubtask}
                  disabled={!subtaskDraft.trim() || subtaskDraftOver}
                >
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
              disabled={!title.trim() || hasOverflow}
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
