"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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

/**
 * For pages whose data comes from their server components:
 * refreshes them on a remote change. `router.refresh()` keeps client state,
 * so neither the scroll nor open dialogs are lost.
 */
export function useRefreshOnRemoteChanges() {
  const router = useRouter();
  useRemoteChanges(() => router.refresh());
}
