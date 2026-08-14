"use client";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/locale-context";

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-9 px-2 font-mono text-xs font-semibold"
      aria-label={t.settings.language}
      onClick={() => setLocale(locale === "es" ? "en" : "es")}
      data-testid="language-toggle"
    >
      {locale === "es" ? "ES" : "EN"}
    </Button>
  );
}
