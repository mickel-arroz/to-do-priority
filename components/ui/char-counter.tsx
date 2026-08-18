import { cn } from "@/lib/utils";

/**
 * Live `length/max` counter. Turns red (using the softened failure tone, not
 * pure red) once the limit is exceeded so the user can keep typing but sees the
 * overflow. Callers block submission separately while any field is over.
 */
export function CharCounter({
  length,
  max,
  className,
}: {
  length: number;
  max: number;
  className?: string;
}) {
  const over = length > max;
  return (
    <span
      aria-live="polite"
      className={cn(
        "text-xs tabular-nums",
        over ? "font-medium text-failure" : "text-muted-foreground",
        className
      )}
    >
      {length}/{max}
    </span>
  );
}
