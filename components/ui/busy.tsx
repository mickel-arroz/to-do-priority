"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps form content so every control inside is disabled while `busy` — native
 * `<fieldset disabled>` semantics — preventing any edits during a save/delete.
 * Carries the form's layout classes (it replaces the form's own layout
 * wrapper); `min-w-0` neutralizes the fieldset min-content sizing quirk.
 */
export function FormFieldset({
  busy,
  className,
  children,
  ...props
}: React.ComponentProps<"fieldset"> & { busy: boolean }) {
  return (
    <fieldset disabled={busy} className={cn("min-w-0", className)} {...props}>
      {children}
    </fieldset>
  );
}

/**
 * onOpenChange wrapper that ignores *close* requests while `locked` (busy), so
 * a dialog can't be dismissed via Esc / outside-click / the close button during
 * a write operation.
 */
export function useLockedOpenChange(
  locked: boolean,
  onOpenChange: (open: boolean) => void
) {
  return React.useCallback(
    (open: boolean) => {
      if (locked && !open) return;
      onOpenChange(open);
    },
    [locked, onOpenChange]
  );
}
