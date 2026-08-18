"use client";

import { TaskCard } from "@/components/tasks/TaskCard";
import { useTaskBoard } from "@/components/tasks/TaskBoard";
import { PRIORITIES } from "@/lib/priority";
import type { Task } from "@/lib/types";

/**
 * Grid card view for the Home "Pending" section. Tasks are grouped by priority
 * (1→4) — each group is its own 3-column grid, so a group never bleeds into the
 * next priority's row. Order within a priority matches the list view (the input
 * is already priority-sorted).
 */
export function PendingCards({ tasks }: { tasks: Task[] }) {
  const board = useTaskBoard();

  const groups = PRIORITIES.map((priority) => ({
    priority,
    items: tasks.filter((task) => task.priority === priority),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.priority}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {group.items.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                today={board.today}
                onComplete={board.completeTask}
                onOpenPomodoro={board.openPomodoro}
                onOpenDetail={board.openDetail}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
