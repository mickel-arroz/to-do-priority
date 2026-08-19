"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import { format } from "date-fns";
import { enUS, es as esLocale } from "date-fns/locale";
import { CalendarDays, Check, Link2, ListChecks, Timer, X } from "@/components/icons";
import { PriorityTag } from "@/components/tasks/PriorityTag";
import { TaskCompleteCheckbox } from "@/components/tasks/TaskCompleteCheckbox";
import { priorityClasses } from "@/lib/priority";
import { parseDate } from "@/lib/recurrence";
import { useLocale } from "@/lib/i18n/locale-context";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD = 80;

type TaskRowProps = {
  task: Task;
  today: string;
  onComplete: (task: Task, status: "yes" | "no") => void;
  onOpenPomodoro: (task: Task) => void;
  onOpenDetail: (task: Task) => void;
};

/**
 * Swipeable task row. Dragging right past the threshold completes it
 * satisfactorily ('yes', green), left completes it unsatisfactorily ('no',
 * red). The leading checkbox opens a menu with the same actions (mark
 * done/failed); the priority is a small colored tag next to the due date.
 */
export function TaskRow({
  task,
  today,
  onComplete,
  onOpenPomodoro,
  onOpenDetail,
}: TaskRowProps) {
  const { locale, t } = useLocale();
  const x = useMotionValue(0);
  const [leaving, setLeaving] = useState<"yes" | "no" | null>(null);
  const [dragging, setDragging] = useState(false);
  const draggedRef = useRef(false);
  const yesOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const noOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  const p = priorityClasses[task.priority];
  const isOverdue = task.due_date < today;
  const isToday = task.due_date === today;
  const dateLocale = locale === "es" ? esLocale : enUS;

  const doneSubtasks = task.subtasks?.filter((s) => s.is_done).length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    setDragging(false);
    const past =
      Math.abs(info.offset.x) > SWIPE_THRESHOLD ||
      Math.abs(info.velocity.x) > 500;
    if (!past) return;
    const status = info.offset.x > 0 ? "yes" : "no";
    setLeaving(status);
    onComplete(task, status);
  }

  // While swiping (or leaving) the priority chrome disappears completely:
  // no colored border, no thick side bar
  const hideChrome = dragging || leaving !== null;

  return (
    <div
      className="relative overflow-hidden rounded-lg"
      data-testid={`task-row-${task.id}`}
    >
      {/* Reveal backgrounds behind the draggable card */}
      <motion.div
        style={{ opacity: yesOpacity }}
        className="absolute inset-0 flex items-center justify-start rounded-lg bg-success px-4"
        aria-hidden
      >
        <Check className="size-6 text-on-strong" />
      </motion.div>
      <motion.div
        style={{ opacity: noOpacity }}
        className="absolute inset-0 flex items-center justify-end rounded-lg bg-failure px-4"
        aria-hidden
      >
        <X className="size-6 text-on-strong" />
      </motion.div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.9}
        style={{ x, touchAction: "pan-y" }}
        onPointerDownCapture={() => {
          draggedRef.current = false;
        }}
        onDragStart={() => {
          setDragging(true);
          draggedRef.current = true;
        }}
        onDragEnd={handleDragEnd}
        animate={
          leaving
            ? { x: leaving === "yes" ? 500 : -500, opacity: 0 }
            : undefined
        }
        transition={{ duration: 0.25 }}
        className={cn(
          "relative flex cursor-grab items-center gap-3 rounded-lg border bg-card py-3 pl-4 pr-3 shadow-sm transition-colors active:cursor-grabbing",
          hideChrome ? "border-transparent" : cn(p.soft, p.ring)
        )}
      >
        {/* Thick priority bar: the color must not go unnoticed (hidden while swiping) */}
        {!hideChrome && (
          <div
            className={cn("absolute inset-y-0 left-0 w-1.5 rounded-l-lg", p.bar)}
            aria-hidden
          />
        )}

        {/* Checkbox: opens a menu to mark the task done or failed */}
        <TaskCompleteCheckbox task={task} onComplete={onComplete} />

        <button
          className="min-w-0 flex-1 text-left"
          onClick={() => {
            if (draggedRef.current) {
              draggedRef.current = false;
              return;
            }
            onOpenDetail(task);
          }}
          data-testid="task-title"
        >
          <span className="block truncate text-sm font-medium">{task.title}</span>
          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <PriorityTag priority={task.priority} />
            <span
              className={cn(
                "flex items-center gap-1",
                isOverdue && "font-semibold text-failure"
              )}
            >
              <CalendarDays className="size-3.5" />
              {isToday
                ? t.tasks.today
                : format(parseDate(task.due_date), "d MMM", { locale: dateLocale })}
              {isOverdue && ` · ${t.tasks.overdue}`}
            </span>
            {totalSubtasks > 0 && (
              <span className="flex items-center gap-1">
                <ListChecks className="size-3.5" />
                {doneSubtasks}/{totalSubtasks}
              </span>
            )}
            {task.link && <Link2 className="size-3.5" />}
          </span>
        </button>

        {task.pomodoro_minutes > 0 && (
          <button
            onClick={() => onOpenPomodoro(task)}
            aria-label={t.pomodoro.title}
            className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
            data-testid="pomodoro-button"
          >
            <Timer className="size-5" />
          </button>
        )}
      </motion.div>
    </div>
  );
}
