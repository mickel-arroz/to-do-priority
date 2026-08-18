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
