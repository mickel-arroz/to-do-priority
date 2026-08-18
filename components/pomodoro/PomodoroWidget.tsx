"use client";

import { Pause, Play, RotateCcw, Timer, X } from "@/components/icons";
import { usePomodoroController } from "@/components/pomodoro/PomodoroProvider";
import { formatCountdown } from "@/hooks/usePomodoro";
import { useT } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

/**
 * Persistent bottom-right pomodoro widget (push-notification style). Shows
 * while a session is active but the full dialog is minimized, so the countdown
 * stays visible across pages. Clicking the body re-opens the dialog.
 */
export function PomodoroWidget() {
  const t = useT();
  const {
    activeTask,
    dialogOpen,
    state,
    remaining,
    totalSeconds,
    start,
    pause,
    reset,
    openDialog,
    stop,
  } = usePomodoroController();

  const isActive = state === "running" || state === "paused" || state === "finished";
  if (!activeTask || dialogOpen || !isActive) return null;

  const progress = totalSeconds === 0 ? 0 : remaining / totalSeconds;

  return (
    <div
      data-testid="pomodoro-widget"
      className="fixed bottom-4 right-4 z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg ring-1 ring-foreground/10"
    >
      {/* Thin progress bar along the top */}
      <div className="h-1 w-full bg-muted">
        <div
          className={cn(
            "h-full transition-[width] duration-200",
            state === "finished" ? "bg-success" : "bg-primary"
          )}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={openDialog}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-label={t.pomodoro.title}
        >
          <Timer className="size-5 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {activeTask.title}
            </span>
            <span
              className="font-mono text-lg font-bold tabular-nums"
              data-testid="pomodoro-widget-time"
            >
              {formatCountdown(remaining)}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {state === "running" ? (
            <button
              type="button"
              onClick={pause}
              aria-label={t.pomodoro.pause}
              title={t.pomodoro.pause}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
            >
              <Pause className="size-4" />
            </button>
          ) : (
            state !== "finished" && (
              <button
                type="button"
                onClick={start}
                aria-label={t.pomodoro.resume}
                title={t.pomodoro.resume}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
              >
                <Play className="size-4" />
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => reset()}
            aria-label={t.pomodoro.reset}
            title={t.pomodoro.reset}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            onClick={stop}
            aria-label={t.common.close}
            title={t.common.close}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-failure"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
