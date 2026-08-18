import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PomodoroProvider,
  usePomodoroController,
} from "@/components/pomodoro/PomodoroProvider";
import type { Task } from "@/lib/types";
import { makeTask, renderWithProviders } from "./helpers";

const playMock = vi.fn().mockResolvedValue(undefined);

/** Opens the global pomodoro for a task, the way a task row would. */
function Opener({ task }: { task: Task }) {
  const { openPomodoro } = usePomodoroController();
  return (
    <button data-testid="open-pomodoro" onClick={() => openPomodoro(task)}>
      open
    </button>
  );
}

function renderPomodoro(task: Task) {
  renderWithProviders(
    <PomodoroProvider>
      <Opener task={task} />
    </PomodoroProvider>
  );
  fireEvent.click(screen.getByTestId("open-pomodoro"));
}

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
    renderPomodoro(task);
    expect(screen.getByTestId("pomodoro-time")).toHaveTextContent("10:00");
  });

  it("counts down while running", () => {
    const task = makeTask({ pomodoro_minutes: 1 });
    renderPomodoro(task);

    fireEvent.click(screen.getByTestId("pomodoro-start"));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByTestId("pomodoro-time")).toHaveTextContent("00:55");
  });

  it("plays the chime when reaching zero", () => {
    const task = makeTask({ pomodoro_minutes: 1 });
    renderPomodoro(task);

    fireEvent.click(screen.getByTestId("pomodoro-start"));
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByTestId("pomodoro-time")).toHaveTextContent("00:00");
    expect(playMock).toHaveBeenCalled();
  });

  it("pauses and resumes", () => {
    const task = makeTask({ pomodoro_minutes: 1 });
    renderPomodoro(task);

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
