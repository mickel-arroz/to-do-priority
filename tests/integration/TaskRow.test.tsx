import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskRow } from "@/components/tasks/TaskRow";
import { makeTask, renderWithProviders } from "./helpers";

const TODAY = "2026-08-14";

describe("TaskRow", () => {
  it("shows title, priority badge and due date", () => {
    const task = makeTask({ title: "Pagar facturas", priority: 1, due_date: TODAY });
    renderWithProviders(
      <TaskRow
        task={task}
        today={TODAY}
        onComplete={vi.fn()}
        onOpenPomodoro={vi.fn()}
        onOpenDetail={vi.fn()}
      />
    );
    expect(screen.getByText("Pagar facturas")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // priority badge
    expect(screen.getByText(/Hoy/)).toBeInTheDocument();
  });

  it("marks overdue tasks", () => {
    const task = makeTask({ due_date: "2026-08-01" });
    renderWithProviders(
      <TaskRow
        task={task}
        today={TODAY}
        onComplete={vi.fn()}
        onOpenPomodoro={vi.fn()}
        onOpenDetail={vi.fn()}
      />
    );
    expect(screen.getByText(/Vencida/)).toBeInTheDocument();
  });

  it("opens the pomodoro from the clock icon", async () => {
    const task = makeTask();
    const onOpenPomodoro = vi.fn();
    renderWithProviders(
      <TaskRow
        task={task}
        today={TODAY}
        onComplete={vi.fn()}
        onOpenPomodoro={onOpenPomodoro}
        onOpenDetail={vi.fn()}
      />
    );
    await userEvent.click(screen.getByTestId("pomodoro-button"));
    expect(onOpenPomodoro).toHaveBeenCalledWith(task);
  });

  it("opens the detail from the title", async () => {
    const task = makeTask();
    const onOpenDetail = vi.fn();
    renderWithProviders(
      <TaskRow
        task={task}
        today={TODAY}
        onComplete={vi.fn()}
        onOpenPomodoro={vi.fn()}
        onOpenDetail={onOpenDetail}
      />
    );
    await userEvent.click(screen.getByTestId("task-title"));
    expect(onOpenDetail).toHaveBeenCalledWith(task);
  });

  it("shows subtask progress", () => {
    const task = makeTask({
      subtasks: [
        { id: "s1", task_id: "t", title: "a", is_done: true, position: 0 },
        { id: "s2", task_id: "t", title: "b", is_done: false, position: 1 },
      ],
    });
    renderWithProviders(
      <TaskRow
        task={task}
        today={TODAY}
        onComplete={vi.fn()}
        onOpenPomodoro={vi.fn()}
        onOpenDetail={vi.fn()}
      />
    );
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });
});
