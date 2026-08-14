"use client";

import { Lightbulb } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/lib/i18n/locale-context";

/**
 * Curious facts / tips about habits with a motivational tone.
 * Deterministic daily rotation so it changes every day but not on
 * every render.
 */
export function MotivationalCard({ dayOfYear }: { dayOfYear: number }) {
  const t = useT();
  const phrase = t.motivation.phrases[dayOfYear % t.motivation.phrases.length];

  return (
    <Card className="gradient-card border-primary/20 py-0 transition-shadow hover:shadow-md">
      <CardContent className="flex items-start gap-3 p-4">
        <span className="gradient-primary rounded-lg p-1.5">
          <Lightbulb className="size-4 text-on-strong" />
        </span>
        <p className="text-sm leading-relaxed">{phrase}</p>
      </CardContent>
    </Card>
  );
}
