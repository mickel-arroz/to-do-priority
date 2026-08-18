"use client";

import { priorityLabel, PRIORITIES, priorityClasses } from "@/lib/priority";
import { useT } from "@/lib/i18n/locale-context";
import type { Priority } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Eisenhower 2x2 matrix selector: each quadrant carries its color with
 * full visual weight.
 */
export function PrioritySelect({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (priority: Priority) => void;
}) {
  const t = useT();

  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.tasks.priority}>
      {PRIORITIES.map((p) => {
        const classes = priorityClasses[p];
        const selected = value === p;
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(p)}
            data-testid={`priority-${p}`}
            className={cn(
              "flex items-center gap-2 rounded-md border-2 px-3 py-[0.585rem] text-left transition-all",
              classes.soft,
              selected
                ? cn(classes.ring, "scale-[1.02] shadow-md")
                : "border-transparent opacity-70 hover:opacity-100"
            )}
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-md font-heading text-sm font-bold text-on-strong",
                classes.bar
              )}
            >
              {p}
            </span>
            <span className={cn("text-xs font-medium leading-tight", classes.text)}>
              {priorityLabel(p, t)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
