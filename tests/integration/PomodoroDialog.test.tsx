import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PomodoroDialog } from "@/components/tasks/PomodoroDialog";
import { makeTask, renderWithProviders } from "./helpers";

const playMock = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "Audio",
    class {
      currentTime = 0;
      play = playMock;
    }
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  playMock.mockClear();
});

describe("PomodoroDialog", () => {
  it("shows the configured minutes for the task", () => {
    const task = makeTask({ pomodoro_minutes: 10 });
    renderWithProviders(<PomodoroDialog task={task} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("pomodoro-time")).toHaveTextContent("10:00");
  });

  it("counts down while running", () => {
    const task = makeTask({ pomodoro_minutes: 1 });
    renderWithProviders(<PomodoroDialog task={task} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId("pomodoro-start"));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByTestId("pomodoro-time")).toHaveTextContent("00:55");
  });

  it("plays the chime when reaching zero", () => {
    const task = makeTask({ pomodoro_minutes: 1 });
    renderWithProviders(<PomodoroDialog task={task} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId("pomodoro-start"));
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByTestId("pomodoro-time")).toHaveTextContent("00:00");
    expect(playMock).toHaveBeenCalled();
  });

  it("pauses and resumes", () => {
    const task = makeTask({ pomodoro_minutes: 1 });
    renderWithProviders(<PomodoroDialog task={task} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId("pomodoro-start"));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    fireEvent.click(screen.getByTestId("pomodoro-pause"));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    // Paused: time frozen
    expect(screen.getByTestId("pomodoro-time")).toHaveTextContent("00:50");
    fireEvent.click(screen.getByTestId("pomodoro-start"));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByTestId("pomodoro-time")).toHaveTextContent("00:45");
  });
});
