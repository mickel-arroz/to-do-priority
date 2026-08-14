import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HabitProgressBar } from "@/components/habits/HabitProgressBar";
import { computeHabitProgress } from "@/lib/habits";
import type { Habit, HabitLog } from "@/lib/types";
import { renderWithProviders } from "./helpers";

const TODAY = "2026-08-14";

function habit(partial: Partial<Habit>): Habit {
  return {
    id: "h1",
    user_id: "u1",
    name: "Leer",
    description: null,
    start_date: "2026-08-01",
    target_days: 30,
    end_date: null,
    punishment_enabled: false,
    created_at: "",
    ...partial,
  };
}

function logs(dates: string[]): HabitLog[] {
  return dates.map((d) => ({
    id: d,
    habit_id: "h1",
    log_date: d,
    status: "completed" as const,
  }));
}

describe("HabitProgressBar", () => {
  it("shows progress out of target with percent", () => {
    const h = habit({ start_date: "2026-08-11" });
    const progress = computeHabitProgress(
      h,
      logs(["2026-08-11", "2026-08-12", "2026-08-13"]),
      TODAY
    );
    renderWithProviders(<HabitProgressBar progress={progress} />);
    expect(screen.getByTestId("habit-progress")).toHaveTextContent("3 días de 30");
    expect(screen.getByTestId("habit-progress")).toHaveTextContent("10%");
  });

  it("shows the indefinite variant without a bar", () => {
    const h = habit({ target_days: null, end_date: null, start_date: "2026-08-11" });
    const progress = computeHabitProgress(h, logs(["2026-08-11"]), TODAY);
    renderWithProviders(<HabitProgressBar progress={progress} />);
    expect(screen.getByTestId("habit-progress")).toHaveTextContent("Indefinido");
  });
});
