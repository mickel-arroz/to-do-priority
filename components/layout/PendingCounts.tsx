"use client";

import { createContext, useContext } from "react";

/** Pending tasks per category id, as last seen by a task board. */
export type PendingCounts = Record<string, number>;

const PendingCountsContext = createContext<(counts: PendingCounts) => void>(
  () => {}
);

/**
 * Lets a task board push fresh per-category pending counts into the sidebar
 * after reconciling, since reconciling no longer re-renders the layout that
 * computed them. Outside the app shell it is a no-op.
 */
export const PendingCountsProvider = PendingCountsContext.Provider;

export function useReportPendingCounts() {
  return useContext(PendingCountsContext);
}
