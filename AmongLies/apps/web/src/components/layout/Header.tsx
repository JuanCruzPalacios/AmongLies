"use client";

import { useState } from "react";
import Link from "next/link";
import { LanguageSelector } from "./LanguageSelector";
import { useAuthStore } from "@/stores/authStore";
import { useSocialStore } from "@/stores/socialStore";
import { useTranslation } from "@/hooks/useTranslation";

const LINK = "px-2 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface-light";

/**
 * `showAccount` en false dentro de una sala: cambiar de cuenta ahí te sacaría de la partida.
 * En el celular los links van en un menú (☰) para que entren en la pantalla.
 */
export function Header({ showAccount = true }: { showAccount?: boolean }) {
  const { t } = useTranslation();
  const { ready, profile, user, signOut } = useAuthStore();
  const pending = useSocialStore((s) => s.incoming.length);
  const [menuOpen, setMenuOpen] = useState(false);

  const badge = pending > 0 && (
    <span
      className="absolute -top-1 -right-1 bg-accent text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center"
      aria-label={t("social.pending_count", { n: pending })}
    >
      {pending}
    </span>
  );

  /** Los mismos links para la fila (escritorio) y para el menú (celular). */
  const links = (onNavigate?: () => void) =>
    showAccount && (
      <>
        <Link href="/ajustes" onClick={onNavigate} aria-label={t("settings.title")} title={t("settings.title")} className={LINK}>
          ⚙️<span className="md:hidden ml-2">{t("settings.title")}</span>
        </Link>
        <Link href="/workshop" onClick={onNavigate} className={LINK}>
          {t("workshop.title")}
        </Link>
        {ready &&
          (user ? (
            <>
              {profile?.is_admin && (
                <Link href="/admin" onClick={onNavigate} className={`${LINK} text-warning`}>
                  {t("nav.admin")}
                </Link>
              )}
              <Link href="/amigos" onClick={onNavigate} className={`${LINK} relative`}>
                {t("social.title")}
                {badge}
              </Link>
              <Link href="/perfil" onClick={onNavigate} className={`${LINK} md:max-w-28 truncate`}>
                @{profile?.username ?? "…"}
              </Link>
              <button
                onClick={() => {
                  onNavigate?.();
                  void signOut();
                }}
                className={`${LINK} text-left cursor-pointer`}
              >
                {t("auth.logout")}
              </button>
            </>
          ) : (
            <Link href="/login" onClick={onNavigate} className={LINK}>
              {t("auth.login")}
            </Link>
          ))}
      </>
    );

  return (
    <header className="relative flex items-center justify-between gap-3 px-4 sm:px-6 py-4">
      <Link href="/" className="flex items-center gap-2">
        <h1 className="font-display text-xl font-bold">
          <span className="text-primary">Among</span>
          <span className="text-accent">Lies</span>
        </h1>
      </Link>
      <div className="flex items-center gap-2">
        <nav className="hidden md:flex items-center gap-2">{links()}</nav>
        {showAccount && (
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label={t("nav.menu")}
            className="md:hidden relative w-9 h-9 rounded-lg border border-border text-lg leading-none cursor-pointer"
          >
            {menuOpen ? "×" : "☰"}
            {badge}
          </button>
        )}
        <LanguageSelector />
      </div>
      {menuOpen && (
        <nav className="md:hidden absolute top-full left-4 right-4 z-50 flex flex-col gap-1 bg-bg-surface border border-border rounded-2xl p-2 shadow-lg">
          {links(() => setMenuOpen(false))}
        </nav>
      )}
    </header>
  );
}
