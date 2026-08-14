"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocale } from "@/lib/i18n/locale-context";
import type { RecurrenceType } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

export type RecurrenceValue = {
  type: RecurrenceType;
  weekdays: number[];
  interval: number;
};

const WEEKDAY_LABELS: Record<"es" | "en", string[]> = {
  es: ["D", "L", "M", "X", "J", "V", "S"],
  en: ["S", "M", "T", "W", "T", "F", "S"],
};

export function RecurrencePicker({
  value,
  onChange,
}: {
  value: RecurrenceValue;
  onChange: (value: RecurrenceValue) => void;
}) {
  const { locale, t } = useLocale();

  const options: { type: RecurrenceType; label: string }[] = [
    { type: "none", label: t.tasks.recurrenceNone },
    { type: "daily", label: t.tasks.recurrenceDaily },
    { type: "weekly", label: t.tasks.recurrenceWeekly },
    { type: "monthly", label: t.tasks.recurrenceMonthly },
    { type: "yearly", label: t.tasks.recurrenceYearly },
  ];

  function toggleWeekday(day: number) {
    const next = value.weekdays.includes(day)
      ? value.weekdays.filter((d) => d !== day)
      : [...value.weekdays, day].sort();
    onChange({ ...value, weekdays: next });
  }

  return (
    <div className="space-y-3">
      <Select
        value={value.type}
        onValueChange={(type) =>
          onChange({
            ...value,
            type: type as RecurrenceType,
            // Daily starts with every weekday selected by default
            weekdays:
              type === "daily" && value.weekdays.length === 0
                ? [0, 1, 2, 3, 4, 5, 6]
                : value.weekdays,
          })
        }
      >
        <SelectTrigger data-testid="recurrence-select" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.type} value={o.type}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.type === "daily" && (
        <div className="flex justify-between gap-1">
          {WEEKDAY_LABELS[locale].map((label, day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleWeekday(day)}
              aria-pressed={value.weekdays.includes(day)}
              className={cn(
                "size-9 rounded-md text-xs font-semibold transition-colors",
                value.weekdays.includes(day)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {value.type === "weekly" && (
        <div className="flex items-center gap-2">
          <Label htmlFor="recurrence-interval" className="text-xs text-muted-foreground">
            {t.tasks.everyNWeeks}
          </Label>
          <Input
            id="recurrence-interval"
            type="number"
            min={1}
            max={52}
            value={value.interval}
            onChange={(e) =>
              onChange({ ...value, interval: Math.max(1, Number(e.target.value) || 1) })
            }
            className="w-20"
          />
        </div>
      )}
    </div>
  );
}
