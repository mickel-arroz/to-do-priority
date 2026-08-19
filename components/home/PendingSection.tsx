"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LayoutGrid, LayoutList } from "@/components/icons";
import { CompletedTaskCard } from "@/components/tasks/CompletedTaskCard";
import { CompletedTaskRow } from "@/components/tasks/CompletedTaskRow";
import { PendingCards } from "@/components/tasks/PendingCards";
import { TaskRows } from "@/components/tasks/TaskBoard";
import { TaskSection } from "@/components/home/TaskSection";
import { TodayProgress } from "@/components/home/TodayProgress";
import { useT } from "@/lib/i18n/locale-context";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "list" | "cards";
const STORAGE_KEY = "home:pendingView";

type PendingSectionProps = {
  pending: Task[];
  completedToday: Task[];
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
  completedToday,
  success,
  failure,
  done,
}: PendingSectionProps) {
  const t = useT();
  const [view, setView] = useState<View>("list");

  // Load the saved preference after mount (avoids SSR/hydration mismatch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "list" || saved === "cards") setView(saved);
    } catch {
      // localStorage unavailable (private mode, etc.) — keep the default
    }
  }, []);

  const changeView = useCallback((next: View) => {
    setView(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore persistence failures
    }
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
      footer={
        completedToday.length === 0 ? null : view === "cards" ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {completedToday.map((task) => (
              <CompletedTaskCard key={task.id} task={task} />
            ))}
          </div>
        ) : (
          completedToday.map((task) => (
            <CompletedTaskRow key={task.id} task={task} />
          ))
        )
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
