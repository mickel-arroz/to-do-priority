"use client";

import { AdviceCard } from "@/components/advice/AdviceCard";
import { resolveAdviceText, type Bilingual } from "@/lib/advice";
import { useLocale } from "@/lib/i18n/locale-context";

/**
 * El consejo llega como dato del servidor en el render inicial: no hay petición
 * desde el cliente, así que nunca aparece un spinner ni un hueco. Como viene en
 * ambos idiomas, cambiar el idioma de la app lo cambia al instante.
 */
export function DailyAdvice({
  advice,
  dayOfYear,
  habitId,
}: {
  /** Consejo guardado, o null si todavía no hay: entonces se pinta una frase. */
  advice: Bilingual | null;
  dayOfYear: number;
  /** Presente en el detalle de un hábito; ausente en la vista de inicio. */
  habitId?: string;
}) {
  const { locale, t } = useLocale();

  return (
    <AdviceCard
      text={resolveAdviceText({
        advice,
        locale,
        phrases: t.motivation.phrases,
        dayOfYear,
        habitId,
      })}
    />
  );
}
