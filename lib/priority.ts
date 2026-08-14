import type { Dictionary } from "@/lib/i18n";
import type { Priority } from "@/lib/types";

export const PRIORITIES: Priority[] = [1, 2, 3, 4];

export const priorityClasses: Record<
  Priority,
  { bar: string; badge: string; text: string; dot: string; soft: string; ring: string }
> = {
  1: {
    bar: "bg-priority-1",
    badge: "bg-priority-1-soft text-priority-1",
    text: "text-priority-1",
    dot: "bg-priority-1",
    soft: "bg-priority-1-soft",
    ring: "border-priority-1",
  },
  2: {
    bar: "bg-priority-2",
    badge: "bg-priority-2-soft text-priority-2",
    text: "text-priority-2",
    dot: "bg-priority-2",
    soft: "bg-priority-2-soft",
    ring: "border-priority-2",
  },
  3: {
    bar: "bg-priority-3",
    badge: "bg-priority-3-soft text-priority-3",
    text: "text-priority-3",
    dot: "bg-priority-3",
    soft: "bg-priority-3-soft",
    ring: "border-priority-3",
  },
  4: {
    bar: "bg-priority-4",
    badge: "bg-priority-4-soft text-priority-4",
    text: "text-priority-4",
    dot: "bg-priority-4",
    soft: "bg-priority-4-soft",
    ring: "border-priority-4",
  },
};

export function priorityLabel(priority: Priority, t: Dictionary): string {
  return {
    1: t.tasks.priority1,
    2: t.tasks.priority2,
    3: t.tasks.priority3,
    4: t.tasks.priority4,
  }[priority];
}
