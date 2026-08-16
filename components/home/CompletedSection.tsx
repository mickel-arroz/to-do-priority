"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskSection } from "@/components/home/TaskSection";
import { CompletedTaskRow } from "@/components/tasks/CompletedTaskRow";
import { useTaskBoard } from "@/components/tasks/TaskBoard";
import { api } from "@/lib/api/client";
import { useLocale } from "@/lib/i18n/locale-context";
import type { CompletedTask } from "@/lib/types";

type CompletedSectionProps = {
  /** Limit to one list; omit for the Home view */
  categoryId?: string;
  /** Show the list each task belongs to (Home) */
  showCategory?: boolean;
  /** Whether the section starts expanded (default true) */
  defaultOpen?: boolean;
};

/**
 * Last 30 completed tasks from /api/tasks/completed, newest completion
 * first. Refetches whenever a task is completed in this board.
 */
export function CompletedSection({
  categoryId,
  showCategory = false,
  defaultOpen = true,
}: CompletedSectionProps) {
  const { t } = useLocale();
  const board = useTaskBoard();
  const [tasks, setTasks] = useState<CompletedTask[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.tasks
      .completed(categoryId)
      .then(({ tasks: data }) => {
        if (!cancelled) setTasks(data);
      })
      .catch(() => {
        if (!cancelled) setTasks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId, board.completedVersion]);

  if (tasks === null) {
    return (
      <div className="space-y-2 py-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }

  // Merge the board's optimistic state so moves show instantly while the
  // refetch is in flight: drop revived (unmarked) tasks, add fresh
  // completions not yet in the fetched list
  const pendingIds = new Set(board.tasks.map((t2) => t2.id));
  const fetchedIds = new Set(tasks.map((t2) => t2.id));
  const optimistic = board.completedToday.filter(
    (t2) =>
      !fetchedIds.has(t2.id) &&
      (!categoryId || t2.category_id === categoryId)
  );
  const visible = [...optimistic, ...tasks]
    .filter((t2) => !pendingIds.has(t2.id))
    .sort(
      (a, b) =>
        (b.completed_at ?? "").localeCompare(a.completed_at ?? "") ||
        a.priority - b.priority
    )
    .slice(0, 30);

  return (
    <TaskSection
      id="completed"
      title={t.home.completed}
      count={visible.length}
      emptyMessage={t.home.emptyCompleted}
      defaultOpen={defaultOpen}
    >
      {visible.map((task) => (
        <CompletedTaskRow key={task.id} task={task} showCategory={showCategory} />
      ))}
    </TaskSection>
  );
}
