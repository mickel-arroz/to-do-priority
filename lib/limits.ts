/**
 * Canonical character limits for user text fields. Shared by the Zod schemas
 * (server-side enforcement) and the form UIs (live counters + submit blocking)
 * so the two never drift apart.
 */
export const LIMITS = {
  taskTitle: 100,
  taskDescription: 4000,
  subtaskTitle: 100,
  habitName: 120,
  habitDescription: 2000,
  categoryName: 60,
} as const;
