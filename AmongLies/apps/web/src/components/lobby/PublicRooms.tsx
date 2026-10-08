"use client";

import { useEffect, useState } from "react";
import { ALL_GAMES, getGameDefinition, type RoomPublicView } from "@amonglies/shared";
import { Avatar } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";
const REFRESH_MS = 5000;
const SELECT = "bg-bg-surface-light border border-border rounded-lg px-2 py-1.5 text-sm";

/** Listado de salas públicas en la home, con filtros. */
export function PublicRooms({ onJoin, disabled }: { onJoin: (code: string) => void; disabled: boolean }) {
  const { t, locale } = useTranslation();
  const [rooms, setRooms] = useState<RoomPublicView[] | null>(null);
  const [game, setGame] = useState("");
  const [lang, setLang] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`${SERVER_URL}/rooms/public`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : []))
        .then((data: RoomPublicView[]) => alive && setRooms(data))
        .catch(() => alive && setRooms((prev) => prev ?? []));
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const isFull = (r: RoomPublicView) => r.maxPlayers > 0 && r.playerCount >= r.maxPlayers;
  const shown = (rooms ?? []).filter(
    (r) =>
      (!game || r.selectedGameId === game) &&
      (!lang || r.locale === lang) &&
      (!onlyOpen || (r.state === "lobby" && !isFull(r))),
  );

  return (
    <section aria-labelledby="public-rooms-title" className="w-full max-w-md space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 id="public-rooms-title" className="font-display font-bold text-lg">{t("public.title")}</h2>
        <div className="flex gap-2 flex-wrap">
          <select aria-label={t("public.game")} value={game} onChange={(e) => setGame(e.target.value)} className={SELECT}>
            <option value="">{t("public.all_games")}</option>
            {ALL_GAMES.map((g) => (
              <option key={g.id} value={g.id}>{g.emoji} {g.name[locale]}</option>
            ))}
          </select>
          <select aria-label={t("public.locale")} value={lang} onChange={(e) => setLang(e.target.value)} className={SELECT}>
            <option value="">🌐</option>
            <option value="es">ES</option>
            <option value="en">EN</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
        <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-primary" />
        {t("public.only_open")}
      </label>
      {rooms === null && <p className="text-sm text-text-muted">…</p>}
      {rooms !== null && shown.length === 0 && <p className="text-sm text-text-muted">{t("public.empty")}</p>}
      <ul className="space-y-2">
        {shown.map((r) => {
          const def = r.selectedGameId ? getGameDefinition(r.selectedGameId) : undefined;
          const canJoin = r.state === "lobby" && !isFull(r);
          return (
            <li key={r.code} className="flex items-center gap-3 bg-bg-surface border border-border rounded-xl px-3 py-2">
              <Avatar avatarId={r.adminAvatarId} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {def ? `${def.emoji} ${def.name[locale]}` : t("public.no_game")}
                </p>
                <p className="text-xs text-text-muted truncate">
                  {t("public.by", { name: r.adminNickname })} · {r.locale.toUpperCase()} ·{" "}
                  {r.maxPlayers > 0 ? `${r.playerCount}/${r.maxPlayers}` : t("public.players", { n: r.playerCount })} ·{" "}
                  {r.state === "lobby" ? t("public.waiting") : t("public.playing")}
                </p>
              </div>
              <button
                type="button"
                disabled={!canJoin || disabled}
                onClick={() => onJoin(r.code)}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isFull(r) ? t("public.full") : t("landing.join.button")}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
