"use client";

import Link from "next/link";
import { LanguageSelector } from "./LanguageSelector";
import { useAuthStore } from "@/stores/authStore";
import { useSocialStore } from "@/stores/socialStore";
import { useTranslation } from "@/hooks/useTranslation";

/** `showAccount` en false dentro de una sala: cambiar de cuenta ahí te sacaría de la partida. */
export function Header({ showAccount = true }: { showAccount?: boolean }) {
  const { t } = useTranslation();
  const { ready, profile, user, signOut } = useAuthStore();
  const pending = useSocialStore((s) => s.incoming.length);

  return (
    <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4">
      <Link href="/" className="flex items-center gap-2">
        <h1 className="font-display text-xl font-bold">
          <span className="text-primary">Among</span>
          <span className="text-accent">Lies</span>
        </h1>
      </Link>
      <div className="flex items-center gap-2">
        {showAccount && (
          <Link
            href="/workshop"
            className="px-2 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface-light"
          >
            {t("workshop.title")}
          </Link>
        )}
        {showAccount && ready && (
          user ? (
            <div className="flex items-center gap-2 text-sm">
              {profile?.is_admin && (
                <Link
                  href="/admin"
                  className="px-2 py-1.5 rounded-lg text-warning hover:bg-bg-surface-light"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/amigos"
                className="relative px-2 py-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-surface-light"
              >
                {t("social.title")}
                {pending > 0 && (
                  <span
                    className="absolute -top-1 -right-1 bg-accent text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center"
                    aria-label={t("social.pending_count", { n: pending })}
                  >
                    {pending}
                  </span>
                )}
              </Link>
              <Link href="/perfil" className="text-text-secondary hover:text-text-primary max-w-28 truncate">
                @{profile?.username ?? "…"}
              </Link>
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
