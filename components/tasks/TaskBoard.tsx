"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { celebrate } from "@/components/feedback/celebrate";
import { PomodoroDialog } from "@/components/tasks/PomodoroDialog";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { TaskRow } from "@/components/tasks/TaskRow";
import { api } from "@/lib/api/client";
import { useLocale } from "@/lib/i18n/locale-context";
import type { Category, Task, TaskStatus } from "@/lib/types";

type TaskBoardContextValue = {
  today: string;
  /** Pending tasks, kept in client state so section moves are instant */
  tasks: Task[];
  /** Tasks completed today (bottom of the Pendientes section) */
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

const TaskBoardContext = createContext<TaskBoardContextValue | null>(null);

export function useTaskBoard() {
  const ctx = useContext(TaskBoardContext);
  if (!ctx) throw new Error("useTaskBoard must be used within TaskBoard");
  return ctx;
}

type TaskBoardProps = {
  categories: Category[];
  today: string;
  initialTasks: Task[];
  initialCompletedToday?: Task[];
  children: React.ReactNode;
};

/**
 * Client orchestrator for every task list view: owns the task state so
 * completing/unmarking moves rows between sections instantly (optimistic),
 * with the server reconciled in the background — no page reload.
 */
export function TaskBoard({
  categories,
  today,
  initialTasks,
  initialCompletedToday,
  children,
}: TaskBoardProps) {
  const { t } = useLocale();
  const router = useRouter();
  const [pomodoroTask, setPomodoroTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formTask, setFormTask] = useState<Task | null>(null);
  const [formCategoryId, setFormCategoryId] = useState<string | undefined>();
  const [completedVersion, setCompletedVersion] = useState(0);

  const [tasks, setTasks] = useState(initialTasks);
  const [completedToday, setCompletedToday] = useState(
    initialCompletedToday ?? []
  );

  // Adopt fresh server data whenever it arrives (background router.refresh)
  const [prevInitial, setPrevInitial] = useState(initialTasks);
  if (initialTasks !== prevInitial) {
    setPrevInitial(initialTasks);
    setTasks(initialTasks);
    setCompletedToday(initialCompletedToday ?? []);
  }

  const completeTask = useCallback(
    (task: Task, status: "yes" | "no") => {
      // Instant move: out of pending, into today's completed
      const completed: Task = {
        ...task,
        status,
        completed_at: new Date().toISOString(),
      };
      setTasks((prev) => prev.filter((t2) => t2.id !== task.id));
      setCompletedToday((prev) => [...prev, completed]);

      if (status === "yes") {
        celebrate();
        const phrases = t.motivation.completedTask;
        toast.success(phrases[Math.floor(Math.random() * phrases.length)]);
      } else {
        toast(t.tasks.completedNo);
      }

      api.tasks
        .complete(task.id, status)
        .then(() => {
          setCompletedVersion((v) => v + 1);
          // Background reconcile (recurring next instance, sidebar counts)
          router.refresh();
        })
        .catch(() => {
          setTasks((prev) => [...prev, task]);
          setCompletedToday((prev) => prev.filter((t2) => t2.id !== task.id));
          toast.error(t.common.error);
        });
    },
    [router, t]
  );

  const changeTaskStatus = useCallback(
    (task: Task, status: TaskStatus) => {
      const prevStatus = task.status;

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

      api.tasks
        .setStatus(task.id, status)
        .then(() => {
          setCompletedVersion((v) => v + 1);
          router.refresh();
        })
        .catch(() => {
          // Roll back the optimistic move
          if (status === "pending") {
            setTasks((prev) => prev.filter((t2) => t2.id !== task.id));
            setCompletedToday((prev) => [...prev, task]);
          } else {
            setCompletedToday((prev) =>
              prev.map((t2) =>
                t2.id === task.id ? { ...t2, status: prevStatus } : t2
              )
            );
          }
          toast.error(t.common.error);
        });
    },
    [router, t]
  );

  const openNewTask = useCallback((categoryId?: string) => {
    setFormTask(null);
    setFormCategoryId(categoryId);
    setFormOpen(true);
  }, []);

  const openEditTask = useCallback((task: Task) => {
    setDetailTask(null);
    setFormTask(task);
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
        openPomodoro: setPomodoroTask,
        openDetail: setDetailTask,
        openNewTask,
      }}
    >
      {children}

      <PomodoroDialog
        task={pomodoroTask}
        onOpenChange={(open) => !open && setPomodoroTask(null)}
      />
      <TaskDetailDialog
        task={detailTask}
        categories={categories}
        onOpenChange={(open) => !open && setDetailTask(null)}
        onEdit={openEditTask}
      />
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
