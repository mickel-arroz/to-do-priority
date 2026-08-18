"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { PomodoroDialog } from "@/components/tasks/PomodoroDialog";
import { PomodoroWidget } from "@/components/pomodoro/PomodoroWidget";
import { usePomodoro, type PomodoroState } from "@/hooks/usePomodoro";
import type { Task } from "@/lib/types";

type PomodoroController = {
  activeTask: Task | null;
  dialogOpen: boolean;
  state: PomodoroState;
  remaining: number;
  totalSeconds: number;
  start: () => void;
  pause: () => void;
  reset: (minutes?: number) => void;
  setMinutes: (minutes: number) => void;
  /** Start (or focus) a pomodoro for a task and open the full dialog */
  openPomodoro: (task: Task) => void;
  /** Re-open the full dialog from the floating widget */
  openDialog: () => void;
  /** Minimize the dialog to the floating widget; the timer keeps running */
  closeDialog: () => void;
  /** Close entirely: stop and reset the timer, hide the widget */
  stop: () => void;
};

const PomodoroContext = createContext<PomodoroController | null>(null);

export function usePomodoroController() {
  const ctx = useContext(PomodoroContext);
  if (!ctx)
    throw new Error("usePomodoroController must be used within PomodoroProvider");
  return ctx;
}

/**
 * App-wide pomodoro. Mounted once in the root layout so the timer survives
 * route changes and dialog closes: closing the dialog only minimizes it to a
 * floating widget (bottom-right), the countdown keeps running in the
 * background until the user explicitly closes/reset it.
 */
export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { state, remaining, totalSeconds, start, pause, reset, setMinutes } =
    usePomodoro(25);

  const openPomodoro = useCallback(
    (task: Task) => {
      // Only reset the clock when switching to a different task; re-opening the
      // same running task just brings the dialog back.
      if (!activeTask || activeTask.id !== task.id) {
        reset(task.pomodoro_minutes);
      }
      setActiveTask(task);
      setDialogOpen(true);
    },
    [activeTask, reset]
  );

  const openDialog = useCallback(() => setDialogOpen(true), []);

  const stop = useCallback(() => {
    reset();
    setActiveTask(null);
    setDialogOpen(false);
  }, [reset]);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    // If the user never started it, don't leave a dangling widget
    if (state === "idle") {
      setActiveTask(null);
    }
  }, [state]);

  const value = useMemo<PomodoroController>(
    () => ({
      activeTask,
      dialogOpen,
      state,
      remaining,
      totalSeconds,
      start,
      pause,
      reset,
      setMinutes,
      openPomodoro,
      openDialog,
      closeDialog,
      stop,
    }),
    [
      activeTask,
      dialogOpen,
      state,
      remaining,
      totalSeconds,
      start,
      pause,
      reset,
      setMinutes,
      openPomodoro,
      openDialog,
      closeDialog,
      stop,
    ]
  );

  return (
    <PomodoroContext.Provider value={value}>
      {children}
      <PomodoroDialog />
      <PomodoroWidget />
    </PomodoroContext.Provider>
  );
}
