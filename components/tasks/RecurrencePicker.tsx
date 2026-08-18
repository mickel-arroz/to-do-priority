"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale } from "@/lib/i18n/locale-context";
import type { RecurrenceType } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

export type RecurrenceValue = {
  type: RecurrenceType;
  weekdays: number[];
  interval: number;
};

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Weekday chips, Monday-first for display. Each entry keeps its real
 * `getDay()` index (0=Sunday..6=Saturday) so stored `recurrence_weekdays`
 * values are unchanged — only the visual order starts on Monday.
 */
const WEEKDAYS: Record<"es" | "en", { label: string; day: number }[]> = {
  es: [
    { label: "L", day: 1 },
    { label: "M", day: 2 },
    { label: "X", day: 3 },
    { label: "J", day: 4 },
    { label: "V", day: 5 },
    { label: "S", day: 6 },
    { label: "D", day: 0 },
  ],
  en: [
    { label: "M", day: 1 },
    { label: "T", day: 2 },
    { label: "W", day: 3 },
    { label: "T", day: 4 },
    { label: "F", day: 5 },
    { label: "S", day: 6 },
    { label: "S", day: 0 },
  ],
};

export function RecurrencePicker({
  value,
  onChange,
}: {
  value: RecurrenceValue;
  onChange: (value: RecurrenceValue) => void;
}) {
  const { locale, t } = useLocale();

  // Daily has two mutually exclusive sub-modes: pick weekdays (default) or a
  // plain "every N days". An empty weekday list means the N-days mode.
  const [dailyMode, setDailyMode] = useState<"weekdays" | "interval">(
    value.type === "daily" && value.weekdays.length === 0
      ? "interval"
      : "weekdays"
  );

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

  function changeType(type: RecurrenceType) {
    if (type === "daily") {
      // Default daily to the weekday sub-mode with every day selected
      setDailyMode("weekdays");
      onChange({
        ...value,
        type,
        weekdays: value.weekdays.length ? value.weekdays : ALL_WEEKDAYS,
      });
    } else {
      onChange({ ...value, type });
    }
  }

  function changeDailyMode(mode: "weekdays" | "interval") {
    setDailyMode(mode);
    if (mode === "weekdays") {
      onChange({
        ...value,
        weekdays: value.weekdays.length ? value.weekdays : ALL_WEEKDAYS,
      });
    } else {
      // N-days mode is encoded by an empty weekday list
      onChange({ ...value, weekdays: [], interval: Math.max(1, value.interval) });
    }
  }

  return (
    <div className="space-y-3">
      <Select
        value={value.type}
        onValueChange={(type) => changeType(type as RecurrenceType)}
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
        <div className="space-y-3">
          <Tabs
            value={dailyMode}
            onValueChange={(m) => changeDailyMode(m as "weekdays" | "interval")}
          >
            <TabsList className="w-full">
              <TabsTrigger
                value="weekdays"
                className="flex-1"
                data-testid="daily-mode-weekdays"
              >
                {t.tasks.weekdays}
              </TabsTrigger>
              <TabsTrigger
                value="interval"
                className="flex-1"
                data-testid="daily-mode-interval"
              >
                {t.tasks.everyNDays}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {dailyMode === "weekdays" ? (
            <div className="flex justify-between gap-1">
              {WEEKDAYS[locale].map(({ label, day }) => (
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
          ) : (
            <div className="flex items-center gap-2">
              <Label
                htmlFor="recurrence-interval"
                className="text-xs text-muted-foreground"
              >
                {t.tasks.everyNDays}
              </Label>
              <NumberInput
                id="recurrence-interval"
                min={1}
                max={365}
                value={value.interval}
                onChange={(interval) => onChange({ ...value, interval })}
                className="w-20"
              />
            </div>
          )}
        </div>
      )}

      {(value.type === "weekly" ||
        value.type === "monthly" ||
        value.type === "yearly") && (
        <div className="flex items-center gap-2">
          <Label
            htmlFor="recurrence-interval"
            className="text-xs text-muted-foreground"
          >
            {value.type === "weekly"
              ? t.tasks.everyNWeeks
              : value.type === "monthly"
                ? t.tasks.everyNMonths
                : t.tasks.everyNYears}
          </Label>
          <NumberInput
            id="recurrence-interval"
            min={1}
            max={value.type === "weekly" ? 52 : 60}
            value={value.interval}
            onChange={(interval) => onChange({ ...value, interval })}
            className="w-20"
          />
        </div>
      )}
    </div>
  );
}
