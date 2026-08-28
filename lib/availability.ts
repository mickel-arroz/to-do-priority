import type { BusyBlock } from "@/lib/types";

/**
 * Núcleo puro de la disponibilidad: normaliza los bloques de tiempo ocupado y
 * los resume para el prompt. Nada aquí hace I/O; la persistencia vive en
 * `app/api/availability` y el consumo, en `lib/advice.ts`.
 *
 * Un bloque es un intervalo semiabierto `[start_minute, end_minute)` dentro de
 * un día de la semana. No cruzan medianoche a propósito: el usuario describe
 * una semana tipo, no una agenda, y partir "de 22:00 a 02:00" en dos bloques es
 * más fácil de leer que arrastrar el desbordamiento por toda la aritmética.
 */

/** 0 = domingo .. 6 = sábado, la convención de `getDay()` y de las recurrencias. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const MINUTES_IN_DAY = 1440;

/**
 * Horas de sueño que el prompt descuenta SIEMPRE, haya o no disponibilidad
 * configurada. No es un dato del usuario: es el supuesto con el que se razona
 * su tiempo real, para que la IA nunca reparta 24 horas.
 */
export const SLEEP_HOURS = 7;

/** Tope de bloques por día: mantiene el formulario legible y la carga acotada. */
export const MAX_BLOCKS_PER_DAY = 8;

/** Orden de presentación, lunes primero, como el resto de la app. */
export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

/** Nombre en inglés por índice de día; sólo viaja al prompt, nunca a la UI. */
const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** Bloque tal y como lo edita el formulario, sin id ni dueño todavía. */
export type BusyBlockInput = {
  weekday: number;
  start_minute: number;
  end_minute: number;
};

export type AvailabilityDay = {
  weekday: Weekday;
  day: (typeof WEEKDAY_NAMES)[number];
  /** Rangos "HH:mm-HH:mm" del día, en orden. */
  busy: string[];
  busyHours: number;
  /** Horas despiertas y sin comprometer: 24 − sueño − ocupado, nunca negativo. */
  freeHours: number;
};

export type AvailabilitySummary = {
  /** false = el usuario nunca configuró nada; se razona con el caso por defecto. */
  configured: boolean;
  sleepHours: number;
  /** Las 7 entradas, de lunes a domingo. Vacío cuando no hay nada configurado. */
  days: AvailabilityDay[];
  averageFreeHours: number;
};

/** "HH:mm" desde minutos. 1440 se muestra como "24:00": es el fin del día. */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * "HH:mm" → minutos. `<input type="time">` no puede escribir "24:00", así que
 * un "00:00" en el campo de fin se lee como medianoche del final del día
 * (1440), que es lo que cualquiera quiere decir al cerrar ahí un bloque.
 */
export function timeToMinutes(value: string, position: "start" | "end"): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m > 0)) return null;
  const minutes = h * 60 + m;
  if (position === "end" && minutes === 0) return MINUTES_IN_DAY;
  return minutes;
}

function isValidBlock(block: BusyBlockInput): boolean {
  return (
    Number.isInteger(block.weekday) &&
    block.weekday >= 0 &&
    block.weekday <= 6 &&
    Number.isInteger(block.start_minute) &&
    Number.isInteger(block.end_minute) &&
    block.start_minute >= 0 &&
    block.end_minute <= MINUTES_IN_DAY &&
    block.end_minute > block.start_minute
  );
}

/**
 * Deja la semana en forma canónica: descarta lo inválido, ordena por día y
 * hora y funde los bloques que se solapan o se tocan. Dos tramos pegados son
 * el mismo tiempo ocupado dicho dos veces, y fundirlos aquí evita contar horas
 * dos veces al resumir. Se aplica en el formulario y otra vez en el endpoint,
 * de modo que lo que se guarda ya está normalizado.
 */
export function normalizeBusyBlocks(blocks: BusyBlockInput[]): BusyBlockInput[] {
  const byDay = new Map<number, BusyBlockInput[]>();

  for (const block of blocks) {
    if (!isValidBlock(block)) continue;
    const list = byDay.get(block.weekday) ?? [];
    list.push({ ...block });
    byDay.set(block.weekday, list);
  }

  const result: BusyBlockInput[] = [];
  for (const weekday of WEEK_ORDER) {
    const list = (byDay.get(weekday) ?? []).sort(
      (a, b) => a.start_minute - b.start_minute
    );
    const merged: BusyBlockInput[] = [];
    for (const block of list) {
      const last = merged[merged.length - 1];
      if (last && block.start_minute <= last.end_minute) {
        last.end_minute = Math.max(last.end_minute, block.end_minute);
      } else {
        merged.push(block);
      }
    }
    result.push(...merged.slice(0, MAX_BLOCKS_PER_DAY));
  }
  return result;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Resumen que viaja al prompt. Las horas libres restan el sueño y lo ocupado
 * sobre el mismo día: si el usuario declara ocupado un tramo nocturno, la resta
 * se lo cobra igual, lo cual tira a la baja y nunca promete tiempo de más.
 */
export function summarizeAvailability(
  blocks: BusyBlockInput[]
): AvailabilitySummary {
  const normalized = normalizeBusyBlocks(blocks);
  const wakingHours = 24 - SLEEP_HOURS;

  if (normalized.length === 0) {
    return {
      configured: false,
      sleepHours: SLEEP_HOURS,
      days: [],
      averageFreeHours: wakingHours,
    };
  }

  const days = WEEK_ORDER.map((weekday) => {
    const dayBlocks = normalized.filter((b) => b.weekday === weekday);
    const busyMinutes = dayBlocks.reduce(
      (total, b) => total + (b.end_minute - b.start_minute),
      0
    );
    const busyHours = round1(busyMinutes / 60);
    return {
      weekday,
      day: WEEKDAY_NAMES[weekday],
      busy: dayBlocks.map(
        (b) => `${minutesToTime(b.start_minute)}-${minutesToTime(b.end_minute)}`
      ),
      busyHours,
      freeHours: round1(Math.max(0, wakingHours - busyHours)),
    };
  });

  return {
    configured: true,
    sleepHours: SLEEP_HOURS,
    days,
    averageFreeHours: round1(
      days.reduce((total, d) => total + d.freeHours, 0) / days.length
    ),
  };
}

/** Los bloques guardados, listos para el formulario o para el resumen. */
export function toBlockInputs(blocks: BusyBlock[]): BusyBlockInput[] {
  return blocks.map((b) => ({
    weekday: b.weekday,
    start_minute: b.start_minute,
    end_minute: b.end_minute,
  }));
}
