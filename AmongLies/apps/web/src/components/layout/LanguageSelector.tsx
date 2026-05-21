"use client";

import { usePlayerStore } from "@/stores/playerStore";
import type { Locale } from "@amonglies/shared";

const LANGUAGES: { code: Locale; label: string; flag: string }[] = [
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
];

export function LanguageSelector() {
  const { locale, setLocale } = usePlayerStore();

  return (
    <div className="relative group">
      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-surface-light border border-border hover:border-primary transition-colors cursor-pointer text-sm">
        <span>{LANGUAGES.find((l) => l.code === locale)?.flag}</span>
        <span className="hidden sm:inline">{LANGUAGES.find((l) => l.code === locale)?.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className="absolute right-0 top-full mt-1 bg-bg-surface border border-border rounded-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 min-w-[140px] shadow-lg">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLocale(lang.code)}
            className={`
              w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors cursor-pointer
              ${locale === lang.code ? "bg-primary/20 text-primary" : "hover:bg-bg-surface-light text-text-secondary hover:text-text-primary"}
            `}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
