import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeContent } from "@/components/home/HomeContent";
import { PomodoroProvider } from "@/components/pomodoro/PomodoroProvider";
import type { Category } from "@/lib/types";
import { makeTask, renderWithProviders, routerMock } from "./helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/",
}));

vi.mock("@/lib/api/client", () => ({
  api: { tasks: { completed: vi.fn().mockResolvedValue({ tasks: [] }) } },
  ApiError: class extends Error {},
}));

const TODAY = "2026-08-14";

const categories: Category[] = [
  {
    id: "c1",
    user_id: "u1",
    name: "General",
    is_default: true,
    position: 0,
    icon: "list",
    color: null,
    created_at: "",
  },
];

function renderHome() {
  return renderWithProviders(
    <PomodoroProvider>
      <HomeContent
        userName="Mickel Arroz"
        hour={9}
        today={TODAY}
        dayOfYear={226}
        tasks={[makeTask({ title: "Regar las plantas", due_date: TODAY })]}
        completedToday={[]}
        categories={categories}
        advice={null}
      />
    </PomodoroProvider>
  );
}

describe("HomeContent", () => {
  it("no muestra la racha", () => {
    const { container } = renderHome();
    expect(screen.getByTestId("home")).toBeInTheDocument();

    // Se busca el widget, no la palabra: alguna frase motivacional habla de
    // rachas y ésa no es la métrica que el dashboard dejó de mostrar.
    expect(container.querySelector(".gradient-streak")).toBeNull();
    expect(container.querySelector(".text-streak")).toBeNull();
    expect(screen.queryByTestId("streak-badge")).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+\s+días de racha/i)).not.toBeInTheDocument();
  });

  it("sigue mostrando el saludo y las tareas", () => {
    renderHome();
    expect(screen.getByText(/Mickel/)).toBeInTheDocument();
    expect(screen.getByText("Regar las plantas")).toBeInTheDocument();
  });
});
