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
import { getNextDueDate } from "@/lib/recurrence";
import type { BoardScope } from "@/lib/task-board";
import { recurrenceSeriesKey } from "@/lib/tasks";
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

/**
 * One task's action queue: the task it belongs to (its real id once known),
 * its last action, a bump per failure or discard, its length.
 */
type Lane = { key: string; tail: Promise<void>; epoch: number; size: number };

/** Prefix of the temporary id an optimistic next instance carries. */
const TEMP_PREFIX = "temp-";

/**
 * The optimistic next instance of a recurring task closed now, or null for a
 * one-time task. Its date comes from the same recurrence function the server
 * uses, from the original due date, so it doesn't jump when the server
 * answers.
 */
function optimisticNext(task: Task, id: string, now: string): Task | null {
  const due = getNextDueDate(task, task.due_date);
  if (!due) return null;
  return {
    ...task,
    id,
    due_date: due,
    status: "pending",
    completed_at: null,
    recurrence_parent_id: task.recurrence_parent_id ?? task.id,
    created_at: now,
    updated_at: now,
    // Own ids, so nothing aimed at them can touch the closed task's subtasks;
    // the reconcile brings the real ones
    subtasks: (task.subtasks ?? []).map((s, i) => ({
      ...s,
      id: `${id}-${i}`,
      task_id: id,
      is_done: false,
    })),
    task_images: [],
  };
}

/** Another task of the same recurring series. */
function sameSeries(task: Task, candidate: Task): boolean {
  return (
    candidate.id !== task.id &&
    task.recurrence_type !== "none" &&
    recurrenceSeriesKey(candidate) === recurrenceSeriesKey(task)
  );
}

/**
 * Pending instances the server deletes when `task` is reverted: same series,
 * born after it closed.
 */
function bornAfterClosing(task: Task, candidate: Task): boolean {
  return (
    sameSeries(task, candidate) &&
    candidate.status === "pending" &&
    !!task.completed_at &&
    Date.parse(candidate.created_at) >= Date.parse(task.completed_at)
  );
}

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

  // Optimistic next instances live under a temporary id until the server
  // returns the real one. `aliases` maps a resolved temporary id to its real
  // id; `createdBy` maps each unresolved one to the task whose closing created
  // it, so a failure there discards it and whatever hangs from it. `nextOf`
  // maps a task closed here to the instance that closing it created, which
  // reverting it removes even if the clocks of client and server disagree.
  const tempSeq = useRef(0);
  const aliases = useRef(new Map<string, string>());
  const createdBy = useRef(new Map<string, string>());
  const nextOf = useRef(new Map<string, string>());

  /** The id the task has now: its real one once the server returned it. */
  const canonical = useCallback(
    (id: string) => aliases.current.get(id) ?? id,
    []
  );

  /** Puts a task in one list (and out of the other), under its current id. */
  const place = useCallback(
    (task: Task, list: "pending" | "completed") => {
      const placed = { ...task, id: canonical(task.id) };
      setTasks((prev) => {
        const rest = prev.filter((t2) => t2.id !== placed.id);
        return list === "pending" ? [...rest, placed] : rest;
      });
      setCompletedToday((prev) => {
        const rest = prev.filter((t2) => t2.id !== placed.id);
        return list === "completed" ? [...rest, placed] : rest;
      });
    },
    [canonical]
  );

  /** Drops whatever is still queued on a task, unsent. */
  const dropQueued = useCallback((key: string) => {
    const lane = lanes.current.get(key);
    if (!lane) return;
    lane.epoch += 1;
    if (lane.size === 0) lanes.current.delete(key);
  }, []);

  /** Optimistic next instances `creator` created that the server never confirmed. */
  const unconfirmedFrom = useCallback(
    (creator: string) =>
      [...createdBy.current]
        .filter(([, by]) => canonical(by) === creator)
        .map(([tempId]) => tempId),
    [canonical]
  );

  /**
   * Undoes an optimistic next instance: out of both lists, its queued actions
   * dropped, and the same for the instances that closing it created in turn.
   */
  const discard = useCallback(
    function discard(tempId: string) {
      createdBy.current.delete(tempId);
      dropQueued(tempId);
      setTasks((prev) => prev.filter((t2) => t2.id !== tempId));
      setCompletedToday((prev) => prev.filter((t2) => t2.id !== tempId));
      unconfirmedFrom(tempId).forEach(discard);
    },
    [dropQueued, unconfirmedFrom]
  );

  /** The server created the instance: swap its temporary id everywhere. */
  const adopt = useCallback((tempId: string, realId: string) => {
    aliases.current.set(tempId, realId);
    createdBy.current.delete(tempId);
    const next = nextOf.current.get(tempId);
    if (next) {
      nextOf.current.delete(tempId);
      nextOf.current.set(realId, next);
    }
    const lane = lanes.current.get(tempId);
    if (lane) {
      lanes.current.delete(tempId);
      if (lane.size > 0) {
        lane.key = realId;
        lanes.current.set(realId, lane);
      }
    }
    const swap = (list: Task[]) =>
      list.map((t2) => (t2.id === tempId ? { ...t2, id: realId } : t2));
    setTasks(swap);
    setCompletedToday(swap);
  }, []);

  /**
   * Queues an action on a task, already applied optimistically. It reaches
   * the server only once the previous action on that same task settled, so
   * quick toggles land in order (completing a recurring task resyncs two
   * habit days, ADR 0005); other tasks' queues run in parallel. An optimistic
   * next instance's queue starts behind the action that creates it, so `run`
   * always gets the task's real id. If the server rejects an action, `undo`
   * puts the task back, whatever was queued behind it is dropped unsent and
   * the instances it created are discarded, with a single toast. The list is
   * reconciled once every queue is empty. It also waits for `after`, other
   * tasks' queues it must not overtake. Returns the task's queue.
   */
  const enqueue = useCallback(
    (
      taskId: string,
      undo: () => void,
      run: (id: string) => Promise<unknown>,
      after: Promise<void>[] = []
    ) => {
      const key = canonical(taskId);
      const lane: Lane = lanes.current.get(key) ?? {
        key,
        tail: Promise.resolve(),
        epoch: 0,
        size: 0,
      };
      lanes.current.set(key, lane);
      const epoch = lane.epoch;
      lane.size += 1;
      outstanding.current += 1;

      lane.tail = Promise.all([lane.tail, ...after])
        .then(async () => {
          // An earlier action on this task, or its creation, failed: this one
          // was undone too
          if (lane.epoch !== epoch) return;
          try {
            await run(lane.key);
          } catch {
            lane.epoch += 1;
            undo();
            unconfirmedFrom(lane.key).forEach(discard);
            toast.error(t.common.error);
          }
          // Even a failed request may have reached the server: refetch
          dirty.current = true;
        })
        .finally(() => {
          lane.size -= 1;
          if (lane.size === 0 && lanes.current.get(lane.key) === lane) {
            lanes.current.delete(lane.key);
          }
          outstanding.current -= 1;
          if (outstanding.current === 0 && dirty.current) {
            // A category's Completed refetch waits for empty queues too
            setCompletedVersion((v) => v + 1);
            reconcile();
          }
        });
      return lane;
    },
    [canonical, discard, reconcile, t, unconfirmedFrom]
  );

  const completeTask = useCallback(
    (task: Task, status: "yes" | "no") => {
      // Instant move: out of pending, into today's completed, and a recurring
      // task's next instance into pending
      const now = new Date().toISOString();
      const completed: Task = { ...task, status, completed_at: now };
      const next = optimisticNext(
        task,
        `${TEMP_PREFIX}${++tempSeq.current}`,
        now
      );
      setTasks((prev) => [
        ...prev.filter((t2) => t2.id !== task.id),
        ...(next ? [next] : []),
      ]);
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

      const lane = enqueue(
        task.id,
        () => place(task, "pending"),
        async (id) => {
          const { nextTask } = await api.tasks.complete(id, status);
          if (!next) return;
          if (nextTask) adopt(next.id, nextTask.id);
          // No instance on the server after all: the reconcile settles it
          else discard(next.id);
        }
      );
      if (next) {
        // Its actions wait for the one creating it, which gives it its id
        createdBy.current.set(next.id, task.id);
        nextOf.current.set(canonical(task.id), next.id);
        lanes.current.set(next.id, {
          key: next.id,
          tail: lane.tail,
          epoch: 0,
          size: 0,
        });
      }
    },
    [adopt, canonical, discard, enqueue, place, t]
  );

  const changeTaskStatus = useCallback(
    (task: Task, status: TaskStatus) => {
      const send = (id: string) => api.tasks.setStatus(id, status);
      if (status !== "pending") {
        setCompletedToday((prev) =>
          prev.map((t2) => (t2.id === task.id ? { ...t2, status } : t2))
        );
        enqueue(task.id, () => place(task, "completed"), send);
        return;
      }

      // Instant revive into the pending list. Like the server, reverting a
      // recurring task also deletes the pending instances born of closing it.
      const revived: Task = { ...task, status: "pending", completed_at: null };
      const key = canonical(task.id);
      const next = nextOf.current.get(key);
      nextOf.current.delete(key);
      const born = tasks.filter(
        (t2) =>
          bornAfterClosing(task, t2) ||
          (next !== undefined && t2.id === canonical(next))
      );
      const bornIds = new Set(born.map((t2) => t2.id));
      for (const id of bornIds) dropQueued(id);
      setCompletedToday((prev) => prev.filter((t2) => t2.id !== task.id));
      setTasks((prev) => [
        ...prev.filter((t2) => t2.id !== task.id && !bornIds.has(t2.id)),
        revived,
      ]);

      // What is still queued on the rest of the series goes first: the server
      // deletes the instances still pending when the revert lands
      const series = [...tasks, ...completedToday]
        .filter((t2) => sameSeries(task, t2) && !bornIds.has(t2.id))
        .flatMap((t2) => lanes.current.get(canonical(t2.id))?.tail ?? []);

      enqueue(
        task.id,
        () => {
          place(task, "completed");
          for (const instance of born) place(instance, "pending");
        },
        send,
        series
      );
    },
    [canonical, completedToday, dropQueued, enqueue, place, tasks]
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
