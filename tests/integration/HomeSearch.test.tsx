import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { celebrate } from "@/components/feedback/celebrate";
import { HomeContent } from "@/components/home/HomeContent";
import { PomodoroProvider } from "@/components/pomodoro/PomodoroProvider";
import { api } from "@/lib/api/client";
import { MAX_RESULTS, MIN_QUERY_LENGTH } from "@/lib/task-search";
import type { Category, Task } from "@/lib/types";
import { makeTask, renderWithProviders, routerMock } from "./helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/",
}));

vi.mock("@/lib/api/client", () => ({
  api: {
    tasks: {
      completed: vi.fn(),
      complete: vi.fn(),
      setStatus: vi.fn(),
      board: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
  },
  ApiError: class extends Error {},
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("@/components/feedback/celebrate", () => ({ celebrate: vi.fn() }));

const TODAY = "2026-10-12";

const category: Category = {
  id: "c1",
  user_id: "u1",
  name: "Casa",
  is_default: true,
  position: 0,
  icon: "list",
  color: null,
  created_at: "",
};

function renderHome(tasks: Task[]) {
  return renderWithProviders(
    <PomodoroProvider>
      <HomeContent
        userName="Mickel"
        hour={9}
        today={TODAY}
        dayOfYear={285}
        tasks={tasks}
        completedToday={[]}
        categories={[category]}
        advice={null}
      />
    </PomodoroProvider>
  );
}

async function openSearch() {
  await userEvent.click(screen.getByTestId("search-button"));
  return screen.findByTestId("search-input");
}

/** Escribe y espera a que la búsqueda haya corrido. */
async function search(text: string) {
  const input = await openSearch();
  await userEvent.type(input, text);
  return screen.findByTestId("search-results");
}

const resultIds = () =>
  Array.from(
    screen.getByTestId("search-results").querySelectorAll("[data-testid^='search-result-']")
  ).map((el) => el.getAttribute("data-testid")!.replace("search-result-", ""));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.tasks.completed).mockResolvedValue({ tasks: [] });
  vi.mocked(api.tasks.board).mockResolvedValue({ tasks: [], completedToday: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("búsqueda de tareas en la home", { timeout: 20_000 }, () => {
  it("la lupa abre el modal con el campo enfocado", async () => {
    renderHome([]);

    const input = await openSearch();

    expect(input).toHaveFocus();
  });

  it("Escape y el botón de cerrar cierran el modal", async () => {
    renderHome([]);

    await openSearch();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByTestId("search-input")).not.toBeInTheDocument()
    );

    await openSearch();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByTestId("search-input")).not.toBeInTheDocument()
    );
  });

  it(`con menos de ${MIN_QUERY_LENGTH} caracteres muestra la ayuda y sin coincidencias el vacío`, async () => {
    renderHome([makeTask({ title: "Regar las plantas" })]);

    const input = await openSearch();
    expect(screen.getByTestId("search-hint")).toBeInTheDocument();

    await userEvent.type(input, "r");
    expect(screen.getByTestId("search-hint")).toBeInTheDocument();

    await userEvent.type(input, "xxxxxxxx");
    expect(await screen.findByTestId("search-empty")).toBeInTheDocument();
  });

  it("recalcula 200 ms después de la última tecla", async () => {
    const regar = makeTask({ title: "Regar las plantas" });
    renderHome([regar]);
    await openSearch();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "re" } });
    act(() => vi.advanceTimersByTime(150));
    fireEvent.change(input, { target: { value: "regar" } });
    act(() => vi.advanceTimersByTime(199));
    expect(screen.queryByTestId("search-results")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId(`search-result-${regar.id}`)).toBeInTheDocument();
  });

  it("busca entre todas las tareas pendientes con erratas y en orden título > descripción > subtareas", async () => {
    const bySubtask = makeTask({
      title: "Compras",
      due_date: "2026-12-01",
      subtasks: [
        { id: "s1", task_id: "x", title: "Pagar factura", is_done: false, position: 0 },
      ],
    });
    const byDescription = makeTask({
      title: "Llamar al banco",
      description: "Preguntar por la factura",
      due_date: "2026-01-01",
    });
    const byTitle = makeTask({ title: "Revisar la factura", due_date: TODAY });
    const unrelated = makeTask({ title: "Regar las plantas", due_date: TODAY });
    renderHome([bySubtask, unrelated, byDescription, byTitle]);

    await search("factrua");

    expect(resultIds()).toEqual([byTitle.id, byDescription.id, bySubtask.id]);
  });

  it(`muestra como máximo ${MAX_RESULTS} resultados`, async () => {
    renderHome(
      Array.from({ length: MAX_RESULTS + 3 }, (_, i) =>
        makeTask({ title: `Factura ${i}`, due_date: TODAY })
      )
    );

    await search("factura");

    expect(resultIds()).toHaveLength(MAX_RESULTS);
  });

  it("el check completa un resultado, que se queda atenuado con su estado, y el tablero lo refleja", async () => {
    const task = makeTask({ title: "Revisar la factura", due_date: TODAY });
    vi.mocked(api.tasks.complete).mockResolvedValue({
      task: { ...task, status: "yes" },
      nextTask: null,
    });
    vi.mocked(api.tasks.board).mockResolvedValue({
      tasks: [],
      completedToday: [{ ...task, status: "yes", completed_at: `${TODAY}T10:00:00Z` }],
    });
    renderHome([task]);
    expect(screen.getByTestId(`task-row-${task.id}`)).toBeInTheDocument();

    const results = await search("factura");
    await userEvent.click(within(results).getByTestId("status-button"));
    await userEvent.click(await screen.findByTestId("status-yes"));

    await waitFor(() => expect(api.tasks.complete).toHaveBeenCalledWith(task.id, "yes"));
    expect(celebrate).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);

    const result = screen.getByTestId(`search-result-${task.id}`);
    expect(result).toHaveAttribute("data-status", "yes");
    expect(within(result).getByTestId(`completed-row-${task.id}`)).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByTestId("search-input")).not.toBeInTheDocument()
    );
    expect(screen.queryByTestId(`task-row-${task.id}`)).not.toBeInTheDocument();
  });

  it("al cambiar el texto la tarea completada desaparece de los resultados", async () => {
    const task = makeTask({ title: "Revisar la factura", due_date: TODAY });
    vi.mocked(api.tasks.complete).mockResolvedValue({
      task: { ...task, status: "no" },
      nextTask: null,
    });
    vi.mocked(api.tasks.board).mockResolvedValue({
      tasks: [],
      completedToday: [{ ...task, status: "no", completed_at: `${TODAY}T10:00:00Z` }],
    });
    renderHome([task]);

    const results = await search("factura");
    await userEvent.click(within(results).getByTestId("status-button"));
    await userEvent.click(await screen.findByTestId("status-no"));
    expect(await screen.findByTestId(`search-result-${task.id}`)).toHaveAttribute(
      "data-status",
      "no"
    );

    await userEvent.type(screen.getByTestId("search-input"), "s");
    expect(await screen.findByTestId("search-empty")).toBeInTheDocument();
  });

  it("el clic en un resultado abre el diálogo de edición", async () => {
    const task = makeTask({ title: "Revisar la factura", due_date: TODAY });
    renderHome([task]);

    const results = await search("factura");
    await userEvent.click(within(results).getByTestId("task-title"));

    expect(await screen.findByTestId("task-title-input")).toHaveValue(
      "Revisar la factura"
    );
  });
});
