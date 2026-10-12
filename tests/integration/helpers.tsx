import { render } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { vi } from "vitest";
import type { Locale } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/i18n/locale-context";
import type { Task } from "@/lib/types";

export function renderWithProviders(
  ui: React.ReactNode,
  { locale = "es" }: { locale?: Locale } = {}
) {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <LocaleProvider initialLocale={locale}>{ui}</LocaleProvider>
    </ThemeProvider>
  );
}

export const routerMock = {
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
};

let seq = 0;
export function makeTask(partial: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `task-${seq}`,
    user_id: "u1",
    category_id: "c1",
    title: `Tarea ${seq}`,
    description: null,
    link: null,
    due_date: "2026-08-14",
    priority: 1,
    status: "pending",
    completed_at: null,
    pomodoro_minutes: 25,
    recurrence_type: "none",
    recurrence_weekdays: null,
    recurrence_interval: 1,
    recurrence_parent_id: null,
    created_at: "",
    updated_at: "",
    subtasks: [],
    task_images: [],
    ...partial,
  };
}

/** Una promesa que el test resuelve a mano, para ver el estado intermedio. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
