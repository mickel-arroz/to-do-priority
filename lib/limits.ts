/**
 * Canonical limits for user-entered content. Shared by the Zod schemas
 * (server-side enforcement) and the form UIs (live counters + submit blocking)
 * so the two never drift apart.
 */
export const LIMITS = {
  taskTitle: 100,
  taskDescription: 4000,
  subtaskTitle: 200,
  habitName: 120,
  habitDescription: 2000,
  categoryName: 60,
  /**
   * How many subtasks fit in one task, counting the ones it already has.
   * Unlike the text limits above, this one has no DB constraint: a row count
   * is not a `length(...)` check. `taskSchema` and the form are what hold it.
   */
  subtasksPerTask: 50,
} as const;
