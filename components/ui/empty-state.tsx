import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Dashed, opaque placeholder shown when a section/list has no items.
 * Opaque `bg-card` on purpose so the page background never shows through.
 */
export function EmptyState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "rounded-lg border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground",
        className
      )}
    >
      {children}
    </p>
  );
}
