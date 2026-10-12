import { render } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { vi } from "vitest";
import type { Locale } from "@/lib/i18n";
import { createLiveSync, type ChangeNotice } from "@/lib/live-sync";
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

/** Identifica la pestaña del test en los avisos del doble de sincronización. */
export const ME = "esta-pestaña";
/** Corto para no esperar 300 ms por test; la agrupación ya tiene su test unitario. */
export const DEBOUNCE_MS = 30;

/** El módulo de sincronización real sobre un canal que el test controla. */
export function fakeLiveSync() {
  const listeners = new Set<(notice: ChangeNotice) => void>();
  const sync = createLiveSync({
    clientId: ME,
    debounceMs: DEBOUNCE_MS,
    connect: (onNotice) => {
      listeners.add(onNotice);
      return () => listeners.delete(onNotice);
    },
  });
  return {
    sync,
    emit: (origin: string) => listeners.forEach((l) => l({ origin })),
  };
}

/** Más que la ventana de agrupación, para que cualquier aviso ya haya salido. */
export const settle = () => new Promise((r) => setTimeout(r, DEBOUNCE_MS * 3));
