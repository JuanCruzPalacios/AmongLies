"use client";

import { LanguageSelector } from "./LanguageSelector";

export function Header() {
  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-4">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-xl font-bold">
          <span className="text-primary">Among</span>
          <span className="text-accent">Lies</span>
        </h1>
      </div>
      <LanguageSelector />
    </header>
  );
}
