"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/locale-context";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // true only on the client after hydration; avoids the theme icon mismatch
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const t = useT();

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-hidden className="size-9" />;
  }

  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9"
      aria-label={`${t.settings.theme}: ${isDark ? t.settings.dark : t.settings.light}`}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      data-testid="theme-toggle"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
