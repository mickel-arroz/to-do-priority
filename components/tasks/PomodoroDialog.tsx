"use client";

import { useEffect } from "react";
import { Minus, Pause, Play, Plus, RotateCcw } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePomodoroController } from "@/components/pomodoro/PomodoroProvider";
import { formatCountdown } from "@/hooks/usePomodoro";
import { useT } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

const RADIUS = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Full pomodoro dialog. State lives in the app-wide PomodoroProvider, so
 * closing this dialog only minimizes it to the floating widget — the timer
 * keeps running.
 */
export function PomodoroDialog() {
  const t = useT();
  const {
    activeTask: task,
    dialogOpen,
    state,
    remaining,
    totalSeconds,
    start,
    pause,
    reset,
    setMinutes,
    closeDialog,
  } = usePomodoroController();

  useEffect(() => {
    if (!task) return;
    if (state === "running" || state === "paused") {
      document.title = `${formatCountdown(remaining)} · ${task.title}`;
      return () => {
        document.title = "To-Do Priority";
      };
    }
  }, [state, remaining, task]);

  const progress = totalSeconds === 0 ? 0 : remaining / totalSeconds;

  return (
    <Dialog
      open={dialogOpen && task !== null}
      onOpenChange={(open) => !open && closeDialog()}
    >
      <DialogContent className="sm:max-w-sm" data-testid="pomodoro-dialog">
        <DialogHeader>
          <DialogTitle>{t.pomodoro.title}</DialogTitle>
          <DialogDescription className="truncate">
            {task?.title}
          </DialogDescription>
        </DialogHeader>

        <div className="relative mx-auto my-2 size-52">
          <svg viewBox="0 0 200 200" className="size-full -rotate-90">
            <circle
              cx="100"
              cy="100"
              r={RADIUS}
              fill="none"
              strokeWidth="10"
              className="stroke-muted"
            />
            <circle
              cx="100"
              cy="100"
              r={RADIUS}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              className={cn(
                "stroke-primary transition-[stroke-dashoffset] duration-200",
                state === "finished" && "stroke-success"
              )}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="font-mono text-4xl font-bold tabular-nums"
              data-testid="pomodoro-time"
            >
              {formatCountdown(remaining)}
            </span>
            {state === "finished" && (
              <span className="mt-1 px-4 text-center text-xs text-success">
                {t.pomodoro.finished}
              </span>
            )}
          </div>
        </div>

        {state === "idle" && (
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              aria-label="-5"
              onClick={() => setMinutes(Math.max(1, totalSeconds / 60 - 5))}
            >
              <Minus className="size-4" />
            </Button>
            <span className="w-24 text-center text-sm text-muted-foreground">
              {totalSeconds / 60} {t.pomodoro.minutes.toLowerCase()}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="+5"
              onClick={() => setMinutes(Math.min(180, totalSeconds / 60 + 5))}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        )}

        <div className="flex justify-center gap-2 pb-2">
          {(state === "idle" || state === "paused") && (
            <Button onClick={start} data-testid="pomodoro-start">
              <Play className="size-4" />
              {state === "paused" ? t.pomodoro.resume : t.pomodoro.start}
            </Button>
          )}
          {state === "running" && (
            <Button onClick={pause} variant="secondary" data-testid="pomodoro-pause">
              <Pause className="size-4" />
              {t.pomodoro.pause}
            </Button>
          )}
          {state !== "idle" && (
            <Button
              variant="ghost"
              onClick={() => reset()}
              data-testid="pomodoro-reset"
            >
              <RotateCcw className="size-4" />
              {t.pomodoro.reset}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
