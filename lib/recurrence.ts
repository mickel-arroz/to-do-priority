import { addDays, addMonths, addWeeks, addYears, format, getDay, parse } from "date-fns";

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type RecurrenceConfig = {
  recurrence_type: RecurrenceType;
  /** 0=Sunday .. 6=Saturday; only for daily */
  recurrence_weekdays: number[] | null;
  /** every N weeks/months/years; used by weekly, monthly and yearly */
  recurrence_interval: number;
};

export const DATE_FORMAT = "yyyy-MM-dd";

export function parseDate(dateStr: string): Date {
  return parse(dateStr, DATE_FORMAT, new Date());
}

export function formatDate(date: Date): string {
  return format(date, DATE_FORMAT);
}

/**
 * Next due date for a recurring task, computed from the date it was
 * completed (or its due date, whichever is later, so overdue tasks don't
 * generate instances in the past). Returns null for one-time tasks.
 */
export function getNextDueDate(
  config: RecurrenceConfig,
  fromDateStr: string
): string | null {
  const from = parseDate(fromDateStr);

  switch (config.recurrence_type) {
    case "none":
      return null;

    case "daily": {
      // Two sub-modes: specific weekdays, or a plain "every N days" (encoded
      // by an empty/null weekday list, using the interval).
      const weekdays = config.recurrence_weekdays ?? [];
      if (weekdays.length === 0) {
        const interval = Math.max(1, config.recurrence_interval || 1);
        return formatDate(addDays(from, interval));
      }
      for (let i = 1; i <= 7; i++) {
        const candidate = addDays(from, i);
        if (weekdays.includes(getDay(candidate))) return formatDate(candidate);
      }
      return null;
    }

    case "weekly": {
      const interval = Math.max(1, config.recurrence_interval || 1);
      return formatDate(addWeeks(from, interval));
    }

    case "monthly": {
      // date-fns clamps Jan 31 -> Feb 28/29 automatically
      const interval = Math.max(1, config.recurrence_interval || 1);
      return formatDate(addMonths(from, interval));
    }

    case "yearly": {
      const interval = Math.max(1, config.recurrence_interval || 1);
      return formatDate(addYears(from, interval));
    }
  }
}
