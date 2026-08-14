"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PomodoroState = "idle" | "running" | "paused" | "finished";

/**
 * Drift-corrected countdown: remaining time is always derived from
 * Date.now() against a target timestamp, so a throttled tab can't skew it.
 * Plays the antique clock chime when reaching zero.
 */
export function usePomodoro(initialMinutes: number) {
  const [totalSeconds, setTotalSeconds] = useState(initialMinutes * 60);
  const [remaining, setRemaining] = useState(initialMinutes * 60);
  const [state, setState] = useState<PomodoroState>("idle");
  const targetRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    clear();
    setRemaining(0);
    setState("finished");
    if (!audioRef.current) {
      audioRef.current = new Audio("/sounds/clock-chime.wav");
    }
    audioRef.current.currentTime = 0;
    void audioRef.current.play().catch(() => {
      // Autoplay can be blocked; the visual state still shows completion
    });
  }, [clear]);

  const tick = useCallback(() => {
    const left = Math.max(0, Math.round((targetRef.current - Date.now()) / 1000));
    setRemaining(left);
    if (left <= 0) finish();
  }, [finish]);

  const start = useCallback(() => {
    targetRef.current = Date.now() + remaining * 1000;
    setState("running");
    clear();
    intervalRef.current = setInterval(tick, 250);
  }, [remaining, clear, tick]);

  const pause = useCallback(() => {
    clear();
    setState("paused");
  }, [clear]);

  const reset = useCallback(
    (minutes?: number) => {
      clear();
      const secs = (minutes ?? totalSeconds / 60) * 60;
      setTotalSeconds(secs);
      setRemaining(secs);
      setState("idle");
    },
    [clear, totalSeconds]
  );

  const setMinutes = useCallback(
    (minutes: number) => {
      if (state !== "idle") return;
      setTotalSeconds(minutes * 60);
      setRemaining(minutes * 60);
    },
    [state]
  );

  useEffect(() => clear, [clear]);

  return { state, remaining, totalSeconds, start, pause, reset, setMinutes };
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
