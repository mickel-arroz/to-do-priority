"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { offlineSync, type LiveSync } from "@/lib/live-sync";

const LiveSyncContext = createContext<LiveSync>(offlineSync);

/**
 * The app's live-sync module (ADR 0010). The app shell provides the real one;
 * outside it, or in tests without a provider, only the refresh on coming back
 * to the app is left.
 */
export const LiveSyncProvider = LiveSyncContext.Provider;

/**
 * Calls `onRemoteChange` when another device or tab changed something, or the
 * page becomes visible again. Always calls the latest callback without
 * resubscribing on every render.
 */
export function useRemoteChanges(onRemoteChange: () => void) {
  const sync = useContext(LiveSyncContext);
  const latest = useRef(onRemoteChange);
  useEffect(() => {
    latest.current = onRemoteChange;
  });
  useEffect(() => sync.subscribe(() => latest.current()), [sync]);
}
