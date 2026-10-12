"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { toast } from "sonner";
import { celebrate } from "@/components/feedback/celebrate";
import { useReportPendingCounts } from "@/components/layout/PendingCounts";
import { usePomodoroController } from "@/components/pomodoro/PomodoroProvider";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { TaskRow } from "@/components/tasks/TaskRow";
import { api } from "@/lib/api/client";
import { useLocale } from "@/lib/i18n/locale-context";
import type { BoardScope } from "@/lib/task-board";
import type { Category, Task, TaskStatus } from "@/lib/types";

type TaskBoardContextValue = {
  today: string;
  /** Pending tasks, kept in client state so section moves are instant */
  tasks: Task[];
  /** Tasks completed in the user's day (Home "Completadas" section) */
  completedToday: Task[];
  /** Bumps after every persisted change; the Completed section refetches on it */
  completedVersion: number;
  completeTask: (task: Task, status: "yes" | "no") => void;
  /** Edit the status of a completed task (yes/no/pending) */
  changeTaskStatus: (task: Task, status: TaskStatus) => void;
  openPomodoro: (task: Task) => void;
  openDetail: (task: Task) => void;
  openNewTask: (categoryId?: string) => void;
};

/** Where a task sat, and how, right before an action moved it. */
type Placement = { list: "pending" | "completed"; task: Task };

/** One task's action queue: its last action, a bump per failure, its length. */
type Lane = { tail: Promise<void>; epoch: number; size: number };

const TaskBoardContext = createContext<TaskBoardContextValue | null>(null);

export function useTaskBoard() {
  const ctx = useContext(TaskBoardContext);
  if (!ctx) throw new Error("useTaskBoard must be used within TaskBoard");
  return ctx;
}

type TaskBoardProps = {
  /** Which list this board shows; reconciling refetches exactly that */
  scope: BoardScope;
  categories: Category[];
  today: string;
  initialTasks: Task[];
  initialCompletedToday?: Task[];
  children: React.ReactNode;
};

/**
 * Client orchestrator for every task list view: owns the task state so
 * completing/unmarking moves rows between sections instantly (optimistic),
 * with the server reconciled in the background through GET /api/tasks/board
 * — no page refresh.
 */
export function TaskBoard({
  scope,
  categories,
  today,
  initialTasks,
  initialCompletedToday,
  children,
}: TaskBoardProps) {
  const { t } = useLocale();
  const pomodoro = usePomodoroController();
  const reportPendingCounts = useReportPendingCounts();
  const [formOpen, setFormOpen] = useState(false);
  const [formTask, setFormTask] = useState<Task | null>(null);
  const [formCategoryId, setFormCategoryId] = useState<string | undefined>();
  const [completedVersion, setCompletedVersion] = useState(0);

  const [tasks, setTasks] = useState(initialTasks);
  const [completedToday, setCompletedToday] = useState(
    initialCompletedToday ?? []
  );

  // Adopt fresh server data whenever it arrives (a router.refresh after saving
  // the task form), but merge today's completions so a just-completed task
  // never flickers out while the refetch lags.
  const [prevInitial, setPrevInitial] = useState(initialTasks);
  if (initialTasks !== prevInitial) {
    setPrevInitial(initialTasks);
    setTasks(initialTasks);
    setCompletedToday((prev) => {
      const server = initialCompletedToday ?? [];
      const serverIds = new Set(server.map((t2) => t2.id));
      const pendingIds = new Set(initialTasks.map((t2) => t2.id));
      const stillOptimistic = prev.filter(
        (t2) => !serverIds.has(t2.id) && !pendingIds.has(t2.id)
      );
      return [...server, ...stillOptimistic];
    });
  }

  // Actions not settled yet (queued or in flight), and whether one succeeded
  // since the list was last replaced. The list is only replaced once every
  // queue is empty, so a response never wipes out an optimistic move still
  // pending; a dropped response leaves `dirty` set so the next settle
  // refetches.
  const outstanding = useRef(0);
  const lanes = useRef(new Map<string, Lane>());
  const dirty = useRef(false);
  const reconcileSeq = useRef(0);
  const categoryId = scope.kind === "category" ? scope.categoryId : undefined;

  const reconcile = useCallback(() => {
    const seq = ++reconcileSeq.current;
    // Snapshot of `dirty` this request answers to
    dirty.current = false;
    api.tasks
      .board(categoryId ? { kind: "category", categoryId } : { kind: "home" })
      .then((data) => {
        // A newer reconcile or a new mutation makes this response stale
        if (seq !== reconcileSeq.current) return;
        if (outstanding.current > 0) {
          dirty.current = true;
          return;
        }
        setTasks(data.tasks);
        if (data.completedToday) setCompletedToday(data.completedToday);
        // The layout's sidebar counts aren't refreshed anymore: hand it ours
        reportPendingCounts(
          categoryId
            ? { [categoryId]: data.tasks.length }
            : Object.fromEntries(
                categories.map((c) => [
                  c.id,
                  data.tasks.filter((t2) => t2.category_id === c.id).length,
                ])
              )
        );
      })
      .catch(() => {
        // Keep the optimistic state; the next settle refetches
        if (seq === reconcileSeq.current) dirty.current = true;
      });
  }, [categoryId, categories, reportPendingCounts]);

  /** Puts a task back where it was before a failed action. */
  const restore = useCallback((before: Placement) => {
    const { task } = before;
    setTasks((prev) => {
      const rest = prev.filter((t2) => t2.id !== task.id);
      return before.list === "pending" ? [...rest, task] : rest;
    });
    setCompletedToday((prev) => {
      const rest = prev.filter((t2) => t2.id !== task.id);
      return before.list === "completed" ? [...rest, task] : rest;
    });
  }, []);

  /**
   * Queues an action on a task, already applied optimistically. It reaches
   * the server only once the previous action on that same task settled, so
   * quick toggles land in order (completing a recurring task resyncs two
   * habit days, ADR 0005); other tasks' queues run in parallel. If the server
   * rejects it, the task goes back to `before` and whatever was queued behind
   * it is dropped unsent, with a single toast. The list is reconciled once
   * every queue is empty.
   */
  const enqueue = useCallback(
    (before: Placement, send: () => Promise<unknown>) => {
      const id = before.task.id;
      const lane =
        lanes.current.get(id) ?? { tail: Promise.resolve(), epoch: 0, size: 0 };
      lanes.current.set(id, lane);
      const epoch = lane.epoch;
      lane.size += 1;
      outstanding.current += 1;

      lane.tail = lane.tail
        .then(async () => {
          // An earlier action on this task failed: this one was undone too
          if (lane.epoch !== epoch) return;
          try {
            await send();
          } catch {
            lane.epoch += 1;
            restore(before);
            toast.error(t.common.error);
          }
          // Even a failed request may have reached the server: refetch
          dirty.current = true;
        })
        .finally(() => {
          lane.size -= 1;
          if (lane.size === 0) lanes.current.delete(id);
          outstanding.current -= 1;
          if (outstanding.current === 0 && dirty.current) {
            // A category's Completed refetch waits for empty queues too
            setCompletedVersion((v) => v + 1);
            reconcile();
          }
        });
    },
    [reconcile, restore, t]
  );

  const completeTask = useCallback(
    (task: Task, status: "yes" | "no") => {
      // Instant move: out of pending, into today's completed
      const completed: Task = {
        ...task,
        status,
        completed_at: new Date().toISOString(),
      };
      setTasks((prev) => prev.filter((t2) => t2.id !== task.id));
      setCompletedToday((prev) => [
        ...prev.filter((t2) => t2.id !== task.id),
        completed,
      ]);

      if (status === "yes") {
        celebrate();
        const phrases = t.motivation.completedTask;
        toast.success(phrases[Math.floor(Math.random() * phrases.length)]);
      } else {
        toast(t.tasks.completedNo);
      }

      enqueue({ list: "pending", task }, () =>
        api.tasks.complete(task.id, status)
      );
    },
    [enqueue, t]
  );

  const changeTaskStatus = useCallback(
    (task: Task, status: TaskStatus) => {
      if (status === "pending") {
        // Instant revive into the pending list
        const revived: Task = { ...task, status: "pending", completed_at: null };
        setCompletedToday((prev) => prev.filter((t2) => t2.id !== task.id));
        setTasks((prev) =>
          prev.some((t2) => t2.id === task.id) ? prev : [...prev, revived]
        );
      } else {
        setCompletedToday((prev) =>
          prev.map((t2) => (t2.id === task.id ? { ...t2, status } : t2))
        );
      }

      enqueue({ list: "completed", task }, () =>
        api.tasks.setStatus(task.id, status)
      );
    },
    [enqueue]
  );

  const openNewTask = useCallback((categoryId?: string) => {
    setFormTask(null);
    setFormCategoryId(categoryId);
    setFormOpen(true);
  }, []);

  // Clicking a task opens the edit form directly (there is no separate detail
  // dialog anymore).
  const openEditTask = useCallback((task: Task) => {
    setFormTask(task);
    setFormCategoryId(undefined);
    setFormOpen(true);
  }, []);

  return (
    <TaskBoardContext.Provider
      value={{
        today,
        tasks,
        completedToday,
        completedVersion,
        completeTask,
        changeTaskStatus,
        openPomodoro: pomodoro.openPomodoro,
        openDetail: openEditTask,
        openNewTask,
      }}
    >
      {children}

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        task={formTask}
        defaultCategoryId={formCategoryId}
        today={today}
      />
    </TaskBoardContext.Provider>
  );
}

export function TaskRows({ tasks }: { tasks: Task[] }) {
  return (
    <>
      {tasks.map((task) => (
        <TaskRowConnected key={task.id} task={task} />
      ))}
    </>
  );
}

function TaskRowConnected({ task }: { task: Task }) {
  const board = useTaskBoard();
  return (
    <TaskRow
      task={task}
      today={board.today}
      onComplete={board.completeTask}
      onOpenPomodoro={board.openPomodoro}
      onOpenDetail={board.openDetail}
    />
  );
}
