"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import type { Locale } from "@amonglies/shared";

const LANGUAGES: { code: Locale; label: string; flag: string }[] = [
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

/** Se abre tocando (no con hover, que en el celular no existe) y se cierra al tocar afuera. */
export function LanguageSelector() {
  const { locale, setLocale } = usePlayerStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === locale);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={current?.label}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-surface-light border border-border hover:border-primary transition-colors cursor-pointer text-sm"
      >
        <span>{current?.flag}</span>
        <span className="hidden sm:inline">{current?.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div role="listbox" className="absolute right-0 top-full mt-1 bg-bg-surface border border-border rounded-xl overflow-hidden z-50 min-w-[140px] shadow-lg">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              role="option"
              aria-selected={locale === lang.code}
              onClick={() => {
                setLocale(lang.code);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors cursor-pointer ${
                locale === lang.code ? "bg-primary/20 text-primary" : "hover:bg-bg-surface-light text-text-secondary hover:text-text-primary"
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
