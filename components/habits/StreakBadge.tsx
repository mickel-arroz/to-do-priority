"use client";

import { Flame } from "@/components/icons";
import { useT } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

export function StreakBadge({
  streak,
  size = "sm",
}: {
  streak: number;
  size?: "sm" | "lg";
}) {
  const t = useT();
  if (streak <= 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-streak/15 font-semibold text-streak",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      )}
      title={`${streak} ${t.home.streak}`}
      data-testid="streak-badge"
    >
      <Flame className={size === "sm" ? "size-3.5" : "size-4"} />
      {streak}
    </span>
  );
}
