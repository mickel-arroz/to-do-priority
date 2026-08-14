import { en, type Dictionary } from "./dictionaries/en";
import { es } from "./dictionaries/es";

export type Locale = "es" | "en";
export type { Dictionary };

export const LOCALE_COOKIE = "locale";
export const DEFAULT_LOCALE: Locale = "es";

const dictionaries: Record<Locale, Dictionary> = { en, es };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export function isLocale(value: unknown): value is Locale {
  return value === "es" || value === "en";
}
