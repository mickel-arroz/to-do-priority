"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LOCALE,
  getDictionary,
  isLocale,
  LOCALE_COOKIE,
  type Dictionary,
  type Locale,
} from "./index";

const LOCALE_STORAGE_KEY = "locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    // User preference lives in localStorage; the cookie mirrors it so SSR
    // renders the right language without a flash.
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
  }, []);

  useEffect(() => {
    // Reconcile the localStorage preference after hydration; it can't be
    // read during SSR, so a synchronous update here is intentional.
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isLocale(stored) && stored !== locale) setLocale(stored);
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale, t: getDictionary(locale) }),
    [locale, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

export function useT(): Dictionary {
  return useLocale().t;
}
