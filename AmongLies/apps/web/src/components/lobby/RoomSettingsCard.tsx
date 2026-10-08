"use client";

import type { Locale, Room } from "@amonglies/shared";
import { getSocket } from "@/lib/socket";
import { useTranslation } from "@/hooks/useTranslation";

const CAPS = [0, 4, 5, 6, 8, 10, 12, 16, 20];

/** Visibilidad, cupo e idioma de la sala. Sólo el admin los cambia (el servidor valida). */
export function RoomSettingsCard({ room, isAdmin }: { room: Room; isAdmin: boolean }) {
  const { t } = useTranslation();
  const update = (data: Partial<Room["settings"]>) => {
    if (isAdmin) getSocket().emit("room:update-settings", data);
  };
  const isPublic = !room.settings.isPrivate;

  return (
    <div className="bg-bg-surface border border-border rounded-2xl p-4 space-y-3">
      <h3 className="font-display font-bold text-xs text-text-secondary uppercase tracking-widest">{t("room.settings")}</h3>
      <div className="flex items-center justify-between gap-2">
        <span id="room-public-label" className="text-sm">{t("room.public")}</span>
        <button
          role="switch"
          aria-checked={isPublic}
          aria-labelledby="room-public-label"
          disabled={!isAdmin}
          onClick={() => update({ isPrivate: isPublic })}
          className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed ${
            isPublic ? "bg-primary" : "bg-bg-surface-light border border-border"
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isPublic ? "translate-x-5" : ""}`} />
        </button>
      </div>
      <p className="text-xs text-text-muted">{isPublic ? t("room.public_hint") : t("room.private_hint")}</p>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="room-cap" className="text-sm">{t("room.cap")}</label>
        <select
          id="room-cap"
          disabled={!isAdmin}
          value={room.settings.maxPlayers}
          onChange={(e) => update({ maxPlayers: Number(e.target.value) })}
          className="bg-bg-surface-light border border-border rounded-lg px-2 py-1 text-sm disabled:opacity-70"
        >
          {CAPS.map((n) => (
            <option key={n} value={n} disabled={n !== 0 && n < room.players.length}>
              {n === 0 ? t("room.no_cap") : n}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="room-locale" className="text-sm">{t("room.locale")}</label>
        <select
          id="room-locale"
          disabled={!isAdmin}
          value={room.settings.locale}
          onChange={(e) => update({ locale: e.target.value as Locale })}
          className="bg-bg-surface-light border border-border rounded-lg px-2 py-1 text-sm disabled:opacity-70"
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>
  );
}
