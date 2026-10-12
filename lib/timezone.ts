/** Cookie donde el navegador guarda la zona horaria real del dispositivo. */
export const TZ_COOKIE = "tz";

/**
 * Devuelve el primer candidato que sea una zona IANA válida.
 * Valida con `Intl` (lanza `RangeError` si la zona no existe) para no confiar
 * en una cookie manipulada. Si ninguno sirve, cae a la zona de la máquina
 * (en local = tu zona; en Vercel = UTC). Nunca lanza.
 */
export function resolveTimeZone(
  ...candidates: (string | null | undefined)[]
): string {
  for (const tz of candidates) {
    if (!tz) continue;
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: tz });
      return tz;
    } catch {
      /* zona inválida: probar el siguiente candidato */
    }
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Rango semiabierto [start, end) de instantes, en ISO 8601 con offset. */
export type DayRange = { start: string; end: string };

/** Offset de la zona en ese instante, en minutos (Caracas ⇒ −240). */
function offsetMinutesAt(instant: number, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(instant)
    .find((p) => p.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? "");
  if (!match) return 0; // "GMT" a secas: UTC
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

function formatOffset(minutes: number): string {
  if (minutes === 0) return "Z";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${minutes < 0 ? "-" : "+"}${hh}:${mm}`;
}

/** Medianoche de `day` (yyyy-MM-dd) en la zona, expresada con su offset. */
function startOfDay(day: string, timeZone: string): string {
  const wallClock = Date.parse(`${day}T00:00:00Z`);
  // El offset depende del instante, que a su vez depende del offset: con una
  // segunda pasada basta para caer del lado correcto de un cambio de horario.
  let offset = offsetMinutesAt(wallClock, timeZone);
  offset = offsetMinutesAt(wallClock - offset * 60_000, timeZone);
  return `${day}T00:00:00${formatOffset(offset)}`;
}

/**
 * El día del usuario como rango de instantes: de su medianoche a la del día
 * siguiente, ambas en su zona (ADR 0003). Es el corte de "completadas hoy";
 * compararlo con la medianoche UTC metía de noche tareas del día anterior.
 */
export function userDayRange(day: string, timeZone: string): DayRange {
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    start: startOfDay(day, timeZone),
    end: startOfDay(next.toISOString().slice(0, 10), timeZone),
  };
}

/** Si el instante cae dentro del rango, comparando instantes y no texto. */
export function isWithinRange(instant: string, range: DayRange): boolean {
  const t = Date.parse(instant);
  return t >= Date.parse(range.start) && t < Date.parse(range.end);
}
