"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskSection } from "@/components/home/TaskSection";
import { CompletedTaskRow } from "@/components/tasks/CompletedTaskRow";
import { useTaskBoard } from "@/components/tasks/TaskBoard";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n/locale-context";
import { sortCompletedToday } from "@/lib/tasks";
import type { Category, CompletedTask, Task } from "@/lib/types";

type CompletedSectionProps =
  | {
      /**
       * Home: sólo lo cerrado en el día del usuario. Sale del estado del
       * `TaskBoard`, que ya trae ese rango del servidor y suma los cierres
       * optimistas, así que no pide nada.
       */
      scope: "userDay";
      /** Para mostrar la lista de cada tarea */
      categories: Category[];
    }
  | {
      /** Categoría: las últimas 30 cerradas de esa lista, de cualquier día. */
      scope: "recent";
      categoryId: string;
    };

/**
 * La sección de Completadas, con el recuento en el encabezado. En el home va
 * colapsada; en una categoría, abierta como siempre.
 */
export function CompletedSection(props: CompletedSectionProps) {
  return props.scope === "userDay" ? (
    <UserDayCompleted categories={props.categories} />
  ) : (
    <RecentCompleted categoryId={props.categoryId} />
  );
}

function UserDayCompleted({ categories }: { categories: Category[] }) {
  const board = useTaskBoard();
  const byId = new Map(categories.map((c) => [c.id, c]));
  const visible: CompletedTask[] = sortCompletedToday(board.completedToday).map(
    (task) => ({ ...task, categories: byId.get(task.category_id) ?? null })
  );
  return <CompletedList tasks={visible} showCategory defaultOpen={false} />;
}

/**
 * Pide /api/tasks/completed y lo vuelve a pedir cada vez que el tablero
 * guarda un cambio.
 */
function RecentCompleted({ categoryId }: { categoryId: string }) {
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
    (t2) => !fetchedIds.has(t2.id) && t2.category_id === categoryId
  );
  const visible = [...optimistic, ...tasks]
    .filter((t2) => !pendingIds.has(t2.id))
    .sort(
      (a, b) =>
        (b.completed_at ?? "").localeCompare(a.completed_at ?? "") ||
        a.priority - b.priority
    )
    .slice(0, 30);

  return <CompletedList tasks={visible} />;
}

function CompletedList({
  tasks,
  showCategory = false,
  defaultOpen = true,
}: {
  tasks: (Task | CompletedTask)[];
  showCategory?: boolean;
  defaultOpen?: boolean;
}) {
  const t = useT();
  return (
    <TaskSection
      id="completed"
      title={t.home.completed}
      count={tasks.length}
      emptyMessage={t.home.emptyCompleted}
      defaultOpen={defaultOpen}
    >
      {tasks.map((task) => (
        <CompletedTaskRow key={task.id} task={task} showCategory={showCategory} />
      ))}
    </TaskSection>
  );
}
