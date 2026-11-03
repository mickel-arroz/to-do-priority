import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { celebrate } from "@/components/feedback/celebrate";
import { HomeContent } from "@/components/home/HomeContent";
import { PomodoroProvider } from "@/components/pomodoro/PomodoroProvider";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import { es } from "@/lib/i18n/dictionaries/es";
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

function renderHome(
  { tasks = [], completedToday = [] }: { tasks?: Task[]; completedToday?: Task[] },
  locale: Locale = "es"
) {
  return renderWithProviders(
    <PomodoroProvider>
      <HomeContent
        userName="Mickel"
        hour={9}
        today={TODAY}
        dayOfYear={285}
        tasks={tasks}
        completedToday={completedToday}
        categories={[category]}
        advice={null}
      />
    </PomodoroProvider>,
    { locale }
  );
}

async function createTask(title: string) {
  await userEvent.click(screen.getByTestId("new-task"));
  await userEvent.type(await screen.findByTestId("task-title-input"), title);
  await userEvent.click(screen.getByTestId("task-save"));
}

async function openTask(task: Task) {
  const row = screen.getByTestId(`task-row-${task.id}`);
  await userEvent.click(within(row).getByTestId("task-title"));
  return screen.findByTestId("task-title-input");
}

async function deleteTask(task: Task) {
  await openTask(task);
  await userEvent.click(screen.getByTestId("task-delete"));
  await userEvent.click(
    await screen.findByRole("button", { name: /^(Eliminar|Delete)$/ })
  );
}

async function close(task: Task, status: "yes" | "no" = "yes") {
  const row = screen.getByTestId(`task-row-${task.id}`);
  await userEvent.click(within(row).getByTestId("status-button"));
  await userEvent.click(await screen.findByTestId(`status-${status}`));
}

async function changeCompletedStatus(task: Task, status: "yes" | "no" | "pending") {
  await userEvent.click(screen.getByTestId("section-completed"));
  const row = await screen.findByTestId(`completed-row-${task.id}`);
  await userEvent.click(within(row).getByTestId("status-button"));
  await userEvent.click(await screen.findByTestId(`status-${status}`));
}

const fail = () => Promise.reject(new Error("caída"));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.tasks.completed).mockResolvedValue({ tasks: [] });
  vi.mocked(api.tasks.board).mockResolvedValue({ tasks: [], completedToday: [] });
});

describe("toasts al crear, editar y borrar tareas", { timeout: 20_000 }, () => {
  it("crear una tarea muestra un toast de éxito", async () => {
    vi.mocked(api.tasks.create).mockResolvedValue({ task: makeTask() });
    renderHome({});

    await createTask("Regar las plantas");

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Tarea creada")
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("editar una tarea muestra un toast de éxito", async () => {
    const task = makeTask({ title: "Regar", due_date: TODAY });
    vi.mocked(api.tasks.update).mockResolvedValue({ task });
    renderHome({ tasks: [task] });

    await userEvent.type(await openTask(task), " mucho");
    await userEvent.click(screen.getByTestId("task-save"));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Cambios guardados")
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("borrar una tarea muestra un toast de éxito", async () => {
    const task = makeTask({ title: "Regar", due_date: TODAY });
    vi.mocked(api.tasks.remove).mockResolvedValue({ ok: true });
    renderHome({ tasks: [task] });

    await deleteTask(task);

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Tarea eliminada")
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("los toasts de éxito salen en inglés", async () => {
    const task = makeTask({ title: "Water", due_date: TODAY });
    vi.mocked(api.tasks.create).mockResolvedValue({ task: makeTask() });
    vi.mocked(api.tasks.update).mockResolvedValue({ task });
    vi.mocked(api.tasks.remove).mockResolvedValue({ ok: true });
    renderHome({ tasks: [task] }, "en");

    await createTask("Water the plants");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Task created"));

    await userEvent.type(await openTask(task), " a lot");
    await userEvent.click(screen.getByTestId("task-save"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Changes saved"));

    await deleteTask(task);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Task deleted"));
  });

  it("si crear falla muestra un toast de error y ninguno de éxito", async () => {
    vi.mocked(api.tasks.create).mockImplementation(fail);
    renderHome({});

    await createTask("Regar las plantas");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Algo salió mal")
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("si editar falla muestra un toast de error y ninguno de éxito", async () => {
    const task = makeTask({ title: "Regar", due_date: TODAY });
    vi.mocked(api.tasks.update).mockImplementation(fail);
    renderHome({ tasks: [task] });

    await userEvent.type(await openTask(task), " mucho");
    await userEvent.click(screen.getByTestId("task-save"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Algo salió mal")
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("si borrar falla muestra un toast de error y ninguno de éxito", async () => {
    const task = makeTask({ title: "Regar", due_date: TODAY });
    vi.mocked(api.tasks.remove).mockImplementation(fail);
    renderHome({ tasks: [task] });

    await deleteTask(task);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Algo salió mal")
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("toasts al cerrar y cambiar el estado", { timeout: 20_000 }, () => {
  it("cerrar sólo muestra el toast motivacional y la celebración, sin uno de éxito extra", async () => {
    const task = makeTask({ title: "Regar", due_date: TODAY });
    vi.mocked(api.tasks.complete).mockResolvedValue({
      task: { ...task, status: "yes" },
      nextTask: null,
    });
    renderHome({ tasks: [task] });

    await close(task);

    await waitFor(() => expect(api.tasks.complete).toHaveBeenCalled());
    expect(celebrate).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(es.motivation.completedTask).toContain(
      vi.mocked(toast.success).mock.calls[0][0]
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("si cerrar falla muestra un toast de error", async () => {
    const task = makeTask({ title: "Regar", due_date: TODAY });
    vi.mocked(api.tasks.complete).mockImplementation(fail);
    renderHome({ tasks: [task] });

    await close(task);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Algo salió mal")
    );
  });

  // A "no" y a "pending" son caminos distintos del tablero: el segundo revive la tarea
  it.each(["no", "pending"] as const)(
    "cambiar el estado de una cerrada a %s no muestra toast de éxito",
    async (status) => {
      const task = makeTask({
        title: "Regar",
        due_date: TODAY,
        status: "yes",
        completed_at: `${TODAY}T10:00:00Z`,
      });
      vi.mocked(api.tasks.setStatus).mockResolvedValue({
        task: { ...task, status },
      });
      renderHome({ completedToday: [task] });

      await changeCompletedStatus(task, status);

      await waitFor(() => expect(api.tasks.setStatus).toHaveBeenCalled());
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    }
  );

  it.each(["no", "pending"] as const)(
    "si cambiar el estado a %s falla muestra un toast de error",
    async (status) => {
      const task = makeTask({
        title: "Regar",
        due_date: TODAY,
        status: "yes",
        completed_at: `${TODAY}T10:00:00Z`,
      });
      vi.mocked(api.tasks.setStatus).mockImplementation(fail);
      renderHome({ completedToday: [task] });

      await changeCompletedStatus(task, status);

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Algo salió mal")
      );
      expect(toast.success).not.toHaveBeenCalled();
    }
  );
});
