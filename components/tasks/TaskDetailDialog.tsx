"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, ImagePlus, Pencil, Trash2, X } from "@/components/icons";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n/locale-context";
import { priorityClasses, priorityLabel } from "@/lib/priority";
import type { Category, Subtask, Task, TaskImage } from "@/lib/types";
import { cn } from "@/lib/utils";

type TaskDetailDialogProps = {
  task: Task | null;
  categories: Category[];
  onOpenChange: (open: boolean) => void;
  onEdit: (task: Task) => void;
};

export function TaskDetailDialog({
  task,
  categories,
  onOpenChange,
  onEdit,
}: TaskDetailDialogProps) {
  const t = useT();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [images, setImages] = useState<TaskImage[]>([]);
  const [uploading, setUploading] = useState(false);

  // Derived-state-during-render: sync local lists when the task changes
  const [prevTaskId, setPrevTaskId] = useState<string | null>(null);
  if ((task?.id ?? null) !== prevTaskId) {
    setPrevTaskId(task?.id ?? null);
    setSubtasks(task?.subtasks ?? []);
    setImages(task?.task_images ?? []);
  }

  if (!task) return null;
  const p = priorityClasses[task.priority];

  async function toggleSubtask(subtask: Subtask) {
    const next = !subtask.is_done;
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtask.id ? { ...s, is_done: next } : s))
    );
    try {
      await api.tasks.toggleSubtask(task!.id, subtask.id, next);
    } catch {
      setSubtasks((prev) =>
        prev.map((s) => (s.id === subtask.id ? { ...s, is_done: !next } : s))
      );
      toast.error(t.common.error);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { image } = await api.tasks.uploadImage(task!.id, file);
      setImages((prev) => [...prev, image]);
      router.refresh();
    } catch {
      toast.error(t.common.error);
    } finally {
      setUploading(false);
    }
  }

  async function removeImage(image: TaskImage) {
    setImages((prev) => prev.filter((i) => i.id !== image.id));
    try {
      await api.tasks.deleteImage(task!.id, image.id);
      router.refresh();
    } catch {
      setImages((prev) => [...prev, image]);
      toast.error(t.common.error);
    }
  }

  async function moveToCategory(categoryId: string) {
    try {
      await api.tasks.update(task!.id, { category_id: categoryId });
      router.refresh();
      toast.success(t.common.save);
    } catch {
      toast.error(t.common.error);
    }
  }

  async function deleteTask() {
    try {
      await api.tasks.remove(task!.id);
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(t.common.error);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <DialogTitle className="leading-snug">{task.title}</DialogTitle>
            <Badge className={cn("shrink-0 font-semibold", p.badge)}>
              P{task.priority} · {priorityLabel(task.priority, t)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <span>
              {t.tasks.dueDate}: <strong>{task.due_date}</strong>
            </span>
            {task.recurrence_type !== "none" && (
              <Badge variant="outline">
                {
                  {
                    daily: t.tasks.recurrenceDaily,
                    weekly: t.tasks.recurrenceWeekly,
                    monthly: t.tasks.recurrenceMonthly,
                    yearly: t.tasks.recurrenceYearly,
                  }[task.recurrence_type]
                }
              </Badge>
            )}
          </div>

          {task.description && (
            <p className="whitespace-pre-wrap leading-relaxed">{task.description}</p>
          )}

          {task.link && (
            <a
              href={task.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="size-4" />
              {task.link}
            </a>
          )}

          <div className="space-y-2">
            <p className="font-medium">{t.tasks.moveToList}</p>
            <Select value={task.category_id} onValueChange={moveToCategory}>
              <SelectTrigger className="w-full" data-testid="move-category-select">
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

          {subtasks.length > 0 && (
            <div className="space-y-2">
              <p className="font-medium">{t.tasks.subtasks}</p>
              <ul className="space-y-1">
                {subtasks
                  .sort((a, b) => a.position - b.position)
                  .map((s) => (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                        <input
                          type="checkbox"
                          checked={s.is_done}
                          onChange={() => toggleSubtask(s)}
                          className="size-4 accent-primary"
                        />
                        <span className={cn(s.is_done && "text-muted-foreground line-through")}>
                          {s.title}
                        </span>
                      </label>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {t.tasks.images}{" "}
                <span className="text-xs text-muted-foreground">
                  ({t.tasks.maxImages})
                </span>
              </p>
              {images.length < 3 && (
                <LoadingButton
                  variant="outline"
                  size="sm"
                  loading={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label={t.tasks.images}
                >
                  {!uploading && <ImagePlus className="size-4" />}
                </LoadingButton>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleUpload}
            />
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img) => (
                  <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border">
                    {img.signed_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.signed_url}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="size-full bg-muted" />
                    )}
                    <button
                      onClick={() => removeImage(img)}
                      aria-label={t.common.delete}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-on-strong opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="flex justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="size-4" />
                  {t.tasks.deleteTask}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t.tasks.deleteTask}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t.tasks.deleteTaskConfirm}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteTask}>
                    {t.common.delete}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button size="sm" onClick={() => onEdit(task)} data-testid="task-edit">
              <Pencil className="size-4" />
              {t.common.edit}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
