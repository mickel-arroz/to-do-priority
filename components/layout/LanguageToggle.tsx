"use client";

import { Languages } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/locale-context";

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9"
      aria-label={`${t.settings.language}: ${locale === "es" ? "ES" : "EN"}`}
      onClick={() => setLocale(locale === "es" ? "en" : "es")}
      data-testid="language-toggle"
    >
      <Languages className="size-4" />
    </Button>
  );
}
