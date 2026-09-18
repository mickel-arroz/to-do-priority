import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskCard } from "@/components/tasks/TaskCard";
import { makeTask, renderWithProviders } from "./helpers";

const TODAY = "2026-08-14";

function renderCard(dueDate: string, locale: "es" | "en" = "es") {
  renderWithProviders(
    <TaskCard
      task={makeTask({ due_date: dueDate })}
      today={TODAY}
      onComplete={vi.fn()}
      onOpenPomodoro={vi.fn()}
      onOpenDetail={vi.fn()}
    />,
    { locale }
  );
}

describe("TaskCard due date", () => {
  it("names the day before as 'Ayer'", () => {
    renderCard("2026-08-13");
    expect(screen.getByText(/Ayer/)).toBeInTheDocument();
  });

  it("names the user's day as 'Hoy'", () => {
    renderCard(TODAY);
    expect(screen.getByText(/Hoy/)).toBeInTheDocument();
  });

  it("names the day after as 'Mañana'", () => {
    renderCard("2026-08-15");
    expect(screen.getByText(/Mañana/)).toBeInTheDocument();
  });

  it("names the day before as 'Yesterday' in English", () => {
    renderCard("2026-08-13", "en");
    expect(screen.getByText(/Yesterday/)).toBeInTheDocument();
  });

  it("names the day after as 'Tomorrow' in English", () => {
    renderCard("2026-08-15", "en");
    expect(screen.getByText(/Tomorrow/)).toBeInTheDocument();
  });

  it("keeps the plain date format for other days", () => {
    renderCard("2026-08-20");
    expect(screen.getByText(/20 ago/)).toBeInTheDocument();
  });

  it("still marks a task due yesterday as overdue", () => {
    renderCard("2026-08-13");
    expect(screen.getByText(/Vencida/)).toBeInTheDocument();
  });
});
