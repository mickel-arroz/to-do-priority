"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { buildCalendarData } from "@/lib/habits";
import { useLocale } from "@/lib/i18n/locale-context";
import type { Habit, HabitLog } from "@/lib/types";
import { cn } from "@/lib/utils";

const MONTHS: Record<"es" | "en", string[]> = {
  es: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

const WEEKDAYS: Record<"es" | "en", string[]> = {
  es: ["L", "M", "X", "J", "V", "S", "D"],
  en: ["M", "T", "W", "T", "F", "S", "S"],
};

const DAY_STYLES: Record<string, string> = {
  completed: "bg-success text-on-strong",
  missed: "bg-failure/80 text-on-strong",
  "today-pending": "border-2 border-primary text-primary font-bold",
  future: "bg-muted text-muted-foreground/50",
  "before-start": "text-muted-foreground/30",
};

export function HabitCalendar({
  habit,
  logs,
  today,
}: {
  habit: Habit;
  logs: HabitLog[];
  today: string;
}) {
  const { locale } = useLocale();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)) - 1);

  const days = buildCalendarData(habit, logs, today, year, month);
  // Monday-first offset for the first day of the month
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  function shift(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  return (
    <div className="space-y-3" data-testid="habit-calendar">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="prev">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="font-heading font-semibold">
          {MONTHS[locale][month]} {year}
        </span>
        <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="next">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS[locale].map((d, i) => (
          <span key={i} className="text-xs font-medium text-muted-foreground">
            {d}
          </span>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {days.map((day) => (
          <span
            key={day.date}
            title={day.date}
            data-status={day.status}
            className={cn(
              "flex aspect-square items-center justify-center rounded-lg text-xs transition-colors",
              DAY_STYLES[day.status]
            )}
          >
            {Number(day.date.slice(8, 10))}
          </span>
        ))}
      </div>
    </div>
  );
}
