"use client";
// Bilingual support (EN default / FR toggle). No library — a context provider,
// two typed dictionaries (en.ts / fr.ts) and locale-aware Intl formatters.
// The choice persists per browser in localStorage ("oxround-locale").

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { en, type Messages } from "./en";
import { fr } from "./fr";

export type { Messages };

export type Locale = "en" | "fr";
const STORAGE_KEY = "oxround-locale";
const dicts: Record<Locale, Messages> = { en, fr };

// For non-React code (data layer, error mappers): reads the saved locale directly.
export function getMessages(): Messages {
  if (typeof window === "undefined") return en;
  try {
    return localStorage.getItem(STORAGE_KEY) === "fr" ? fr : en;
  } catch {
    return en;
  }
}

const Ctx = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({
  locale: "en",
  setLocale: () => {},
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Server renders EN; the saved choice applies right after mount (avoids
  // hydration mismatch — FR users may see a brief English flash on first paint).
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "fr") setLocaleState("fr");
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  };

  return <Ctx.Provider value={{ locale, setLocale }}>{children}</Ctx.Provider>;
}

export function useLocale() {
  return useContext(Ctx);
}

// The main hook: `const t = useT();` then `t.members.title`.
export function useT(): Messages {
  return dicts[useContext(Ctx).locale];
}

// Locale-aware date/number/currency formatting (fr-CA: "6 juill. 2026", "49,99 $").
export function useFormat() {
  const { locale } = useContext(Ctx);
  const tag = locale === "fr" ? "fr-CA" : "en-CA";
  return {
    date: (d: string | number | Date, opts?: Intl.DateTimeFormatOptions) =>
      new Date(d).toLocaleDateString(tag, opts ?? { year: "numeric", month: "short", day: "numeric" }),
    dateTime: (d: string | number | Date, opts?: Intl.DateTimeFormatOptions) =>
      new Date(d).toLocaleString(tag, opts ?? { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    time: (d: string | number | Date) =>
      new Date(d).toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit" }),
    money: (n: number) =>
      new Intl.NumberFormat(tag, { style: "currency", currency: "CAD" }).format(n),
    number: (n: number) => new Intl.NumberFormat(tag).format(n),
  };
}

// FR/EN switch — rendered in the sidebar footer and on the login page.
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const btn = (l: Locale, label: string) => (
    <button
      key={l}
      onClick={() => setLocale(l)}
      aria-pressed={locale === l}
      className={`rounded px-2 py-1 text-xs font-semibold ${
        locale === l ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className={`inline-flex items-center gap-1 rounded-md border border-neutral-200 p-0.5 ${className}`}>
      {btn("en", "EN")}
      {btn("fr", "FR")}
    </div>
  );
}
