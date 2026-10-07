"use client";

import Link from "next/link";
import { LanguageSelector } from "./LanguageSelector";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/hooks/useTranslation";

/** `showAccount` en false dentro de una sala: cambiar de cuenta ahí te sacaría de la partida. */
export function Header({ showAccount = true }: { showAccount?: boolean }) {
  const { t } = useTranslation();
  const { ready, profile, user, signOut } = useAuthStore();

  return (
    <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4">
      <Link href="/" className="flex items-center gap-2">
        <h1 className="font-display text-xl font-bold">
          <span className="text-primary">Among</span>
          <span className="text-accent">Lies</span>
        </h1>
      </Link>
      <div className="flex items-center gap-2">
        {showAccount && ready && (
          user ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text-secondary hidden sm:inline">@{profile?.username ?? "…"}</span>
              <button
                onClick={() => void signOut()}
                className="px-3 py-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-surface-light cursor-pointer"
              >
                {t("auth.logout")}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface-light"
            >
              {t("auth.login")}
            </Link>
          )
        )}
        <LanguageSelector />
      </div>
    </header>
  );
}
