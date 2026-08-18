import { priorityClasses } from "@/lib/priority";
import type { Priority } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Small colored priority indicator shown next to a task's due date. Compact
 * on purpose (the priority no longer occupies the leading slot — a checkbox
 * does), while still carrying the priority color + number.
 */
export function PriorityTag({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <span
      title={`P${priority}`}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-bold leading-none text-on-strong",
        priorityClasses[priority].bar,
        className
      )}
    >
      <span className="translate-y-[0.5px]">{priority}</span>
    </span>
  );
}
