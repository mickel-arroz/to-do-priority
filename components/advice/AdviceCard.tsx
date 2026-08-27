import { Lightbulb } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Tarjeta de consejo: sólo pinta. El texto llega ya resuelto —consejo de la IA
 * o frase motivacional—, así que este componente no sabe de dónde viene.
 */
export function AdviceCard({ text }: { text: string }) {
  return (
    <Card className="gradient-card border-primary/20 py-0 transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="gradient-primary shrink-0 rounded-lg p-1.5">
          <Lightbulb className="size-4 text-on-strong" />
        </span>
        <p className="text-sm leading-relaxed">{text}</p>
      </CardContent>
    </Card>
  );
}
