"use client";

import { Lightbulb } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/lib/i18n/locale-context";

/**
 * Curious facts / tips about habits with a motivational tone.
 * Picks one phrase pseudo-randomly per day (the day-of-year seeds an LCG),
 * so it looks random yet stays stable for the whole day and across renders.
 */
export function MotivationalCard({ dayOfYear }: { dayOfYear: number }) {
  const t = useT();
  const phrases = t.motivation.phrases;
  // Classic LCG hash → a shuffled-looking index that only changes per day
  const seed = (dayOfYear * 9301 + 49297) % 233280;
  const phrase = phrases[Math.floor((seed / 233280) * phrases.length)];

  return (
    <Card className="gradient-card border-primary/20 py-0 transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="gradient-primary shrink-0 rounded-lg p-1.5">
          <Lightbulb className="size-4 text-on-strong" />
        </span>
        <p className="text-sm leading-relaxed">{phrase}</p>
      </CardContent>
    </Card>
  );
}
