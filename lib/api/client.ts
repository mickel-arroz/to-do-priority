import type {
  Category,
  CompletedTask,
  Habit,
  HabitLog,
  Subtask,
  Task,
  TaskImage,
} from "@/lib/types";
import type { RecurrenceType } from "@/lib/recurrence";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Full parsed response body, so callers can read structured fields */
    public body?: Record<string, unknown>
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 401) {
    // Full navigation on purpose: the session is gone, so client state
    // must be discarded entirely
    window.location.assign(new URL("/login", window.location.origin));
    throw new ApiError(401, "Unauthorized");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? "request_failed", body);
  }
  return body as T;
}

export type TaskInput = {
  title: string;
  description?: string | null;
  category_id: string;
  link?: string | null;
  due_date: string;
  priority: number;
  pomodoro_minutes?: number;
  recurrence_type?: RecurrenceType;
  recurrence_weekdays?: number[] | null;
  recurrence_interval?: number;
  subtasks?: { title: string }[];
};

export type CategoryInput = {
  name: string;
  icon?: string;
  color?: string | null;
};

export type HabitInput = {
  name: string;
  description?: string | null;
  start_date?: string;
  target_days?: number | null;
  end_date?: string | null;
  punishment_enabled?: boolean;
  task_ids: string[];
};

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ user: { id: string; email: string } }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    register: (fullName: string, email: string, password: string) =>
      request<{ user: { id: string } | null; needsEmailConfirmation: boolean }>(
        "/api/auth/register",
        { method: "POST", body: JSON.stringify({ fullName, email, password }) }
      ),
    google: () =>
      request<{ url: string }>("/api/auth/google", { method: "POST" }),
    signout: () => request<{ ok: true }>("/api/auth/signout", { method: "POST" }),
  },
  tasks: {
    list: (params?: {
      categoryId?: string;
      q?: string;
      limit?: number;
      offset?: number;
    }) => {
      const qs = new URLSearchParams();
      if (params?.categoryId) qs.set("categoryId", params.categoryId);
      if (params?.q) qs.set("q", params.q);
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      const query = qs.toString();
      return request<{ tasks: Task[]; hasMore?: boolean }>(
        `/api/tasks${query ? `?${query}` : ""}`
      );
    },
    completed: (categoryId?: string) =>
      request<{ tasks: CompletedTask[] }>(
        `/api/tasks/completed${categoryId ? `?categoryId=${categoryId}` : ""}`
      ),
    create: (input: TaskInput) =>
      request<{ task: Task }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: Partial<TaskInput>) =>
      request<{ task: Task }>(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    remove: (id: string) =>
      request<{ ok: true }>(`/api/tasks/${id}`, { method: "DELETE" }),
    complete: (id: string, status: "yes" | "no") =>
      request<{ task: Task; nextTask: Task | null }>(`/api/tasks/${id}/complete`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    setStatus: (id: string, status: "pending" | "yes" | "no") =>
      request<{ task: Task }>(`/api/tasks/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    uploadImage: async (id: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/tasks/${id}/images`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(res.status, body.error ?? "upload_failed");
      }
      return (await res.json()) as { image: TaskImage };
    },
    deleteImage: (taskId: string, imageId: string) =>
      request<{ ok: true }>(`/api/tasks/${taskId}/images?imageId=${imageId}`, {
        method: "DELETE",
      }),
    toggleSubtask: (taskId: string, subtaskId: string, isDone: boolean) =>
      request<{ subtask: Subtask }>(`/api/tasks/${taskId}/subtasks`, {
        method: "PATCH",
        body: JSON.stringify({ subtaskId, is_done: isDone }),
      }),
    updateSubtask: (taskId: string, subtaskId: string, title: string) =>
      request<{ subtask: Subtask }>(`/api/tasks/${taskId}/subtasks`, {
        method: "PATCH",
        body: JSON.stringify({ subtaskId, title }),
      }),
    addSubtask: (taskId: string, title: string) =>
      request<{ subtask: Subtask }>(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    removeSubtask: (taskId: string, subtaskId: string) =>
      request<{ ok: true }>(
        `/api/tasks/${taskId}/subtasks?subtaskId=${subtaskId}`,
        { method: "DELETE" }
      ),
  },
  categories: {
    list: () => request<{ categories: Category[] }>("/api/categories"),
    create: (input: CategoryInput) =>
      request<{ category: Category }>("/api/categories", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: Partial<CategoryInput>) =>
      request<{ category: Category }>(`/api/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    remove: (id: string, strategy: "move" | "delete") =>
      request<{ ok: true }>(`/api/categories/${id}?strategy=${strategy}`, {
        method: "DELETE",
      }),
  },
  habits: {
    list: () => request<{ habits: Habit[]; logs: HabitLog[] }>("/api/habits"),
    get: (id: string) =>
      request<{ habit: Habit; logs: HabitLog[]; tasks: Task[] }>(
        `/api/habits/${id}`
      ),
    create: (input: HabitInput) =>
      request<{ habit: Habit }>("/api/habits", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: Partial<HabitInput>) =>
      request<{ habit: Habit }>(`/api/habits/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    remove: (id: string) =>
      request<{ ok: true }>(`/api/habits/${id}`, { method: "DELETE" }),
    syncMissed: (id: string) =>
      request<{ logs: HabitLog[] }>(`/api/habits/${id}/logs`, {
        method: "POST",
      }),
  },
};
