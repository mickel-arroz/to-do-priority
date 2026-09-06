"use client";

import { ShieldAlert } from "@/components/icons";

/**
 * Error del formulario, visible y anunciado a lectores de pantalla. El toast
 * se va solo; esto se queda mientras el problema siga ahí.
 */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <p
      role="alert"
      data-testid="auth-error"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-[color-mix(in_oklab,var(--destructive)_10%,var(--card))] px-3 py-2 text-sm text-destructive"
    >
      <ShieldAlert className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
