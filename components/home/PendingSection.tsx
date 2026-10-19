"use client";

import { useCallback, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LayoutGrid, LayoutList } from "@/components/icons";
import { PendingCards } from "@/components/tasks/PendingCards";
import { TaskRows } from "@/components/tasks/TaskBoard";
import { TaskSection } from "@/components/home/TaskSection";
import { TodayProgress } from "@/components/home/TodayProgress";
import { useT } from "@/lib/i18n/locale-context";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "list" | "cards";
const STORAGE_KEY = "home:pendingView";
/** Same-tab notice: the native "storage" event only fires in other tabs. */
const VIEW_CHANGE_EVENT = "home:pendingView-change";

/** Fallback when localStorage can't be written: the toggle still works this session. */
let sessionView: View = "list";

function readView(): View {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "list" || saved === "cards") return saved;
  } catch {
    // localStorage unavailable (private mode, etc.) — use this session's choice
  }
  return sessionView;
}

function subscribeView(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(VIEW_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(VIEW_CHANGE_EVENT, onChange);
  };
}

type PendingSectionProps = {
  pending: Task[];
  success: number;
  failure: number;
  done: number;
};

/**
 * Home "Pending" section. Unlike the other sections it offers two layouts —
 * list (default) and a priority-grouped card grid — toggled by inline icons on
 * the progress line, with the choice persisted to localStorage. The switch is
 * cross-faded for a smooth transition.
 */
export function PendingSection({
  pending,
  success,
  failure,
  done,
}: PendingSectionProps) {
  const t = useT();
  // The saved preference, read from localStorage. The server snapshot is the
  // default, so hydration matches and the saved view applies right after.
  const view = useSyncExternalStore(subscribeView, readView, () => "list" as View);

  const changeView = useCallback((next: View) => {
    sessionView = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore persistence failures
    }
    window.dispatchEvent(new Event(VIEW_CHANGE_EVENT));
  }, []);

  return (
    <TaskSection
      id="pending"
      title={t.home.pending}
      count={pending.length}
      emptyMessage={t.home.emptyPending}
      aside={
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <TodayProgress
              success={success}
              failure={failure}
              total={done + pending.length}
            />
          </div>
          <ViewToggle value={view} onChange={changeView} />
        </div>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {view === "list" ? (
            <div className="space-y-2">
              <TaskRows tasks={pending} />
            </div>
          ) : (
            <PendingCards tasks={pending} />
          )}
        </motion.div>
      </AnimatePresence>
    </TaskSection>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: View;
  onChange: (view: View) => void;
}) {
  const t = useT();
  const items: { view: View; label: string; Icon: typeof LayoutList }[] = [
    { view: "list", label: t.home.viewList, Icon: LayoutList },
    { view: "cards", label: t.home.viewCards, Icon: LayoutGrid },
  ];
  return (
    <div
      className="flex shrink-0 items-center gap-0.5 rounded-md border p-0.5"
      role="group"
      aria-label={t.home.viewList}
    >
      {items.map(({ view, label, Icon }) => (
        <button
          key={view}
          type="button"
          onClick={() => onChange(view)}
          aria-pressed={value === view}
          aria-label={label}
          title={label}
          data-testid={`pending-view-${view}`}
          className={cn(
            "rounded p-1 transition-colors",
            value === view
              ? "bg-accent text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
