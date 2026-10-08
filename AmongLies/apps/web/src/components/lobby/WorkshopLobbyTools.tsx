"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Room } from "@amonglies/shared";
import { getSocket } from "@/lib/socket";
import { myWorkshopItems, workshopApi, type WorkshopRow } from "@/lib/workshop";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/hooks/useTranslation";

/** Las listas y presets de la colección del admin (se cargan una vez por sala). */
export function useMyWorkshop() {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<WorkshopRow[]>([]);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (user) void myWorkshopItems(user.id).then(setItems);
  }, [user, version]);
  return { items: user ? items : [], reload: () => setVersion((v) => v + 1) };
}

/** Aplicar un preset propio o guardar los ajustes actuales como preset (sólo admin con cuenta). */
export function PresetTools({ room, presets, onSaved }: { room: Room; presets: WorkshopRow[]; onSaved: () => void }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const gamePresets = presets.filter((p) => p.kind === "preset" && "gameId" in p.content && p.content.gameId === room.selectedGameId);

  function apply() {
    const preset = gamePresets.find((p) => p.id === selected);
    if (!preset || !("settings" in preset.content)) return;
    getSocket().emit("game:update-settings", preset.content.settings);
    setNotice(t("workshop.preset_applied", { title: preset.title }));
  }

  async function saveAsPreset() {
    const title = window.prompt(t("workshop.preset_name"))?.trim();
    if (!title || !room.selectedGameId) return;
    const result = await workshopApi.save({ kind: "preset", title, gameId: room.selectedGameId, settings: room.gameSettings });
    setNotice(result.ok ? t("workshop.preset_saved") : t(`workshop.error.${result.error}`));
    if (result.ok) onSaved();
  }

  return (
    <div className="bg-bg-surface-light/50 border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-text-secondary">{t("workshop.presets")}</span>
        {gamePresets.length > 0 ? (
          <>
            <select
              aria-label={t("workshop.presets")}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="bg-bg-surface border border-border rounded-lg px-2 py-1.5 text-sm flex-1 min-w-32"
            >
              <option value="">{t("workshop.choose_preset")}</option>
              {gamePresets.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <button type="button" disabled={!selected} onClick={apply} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold cursor-pointer disabled:opacity-50">
              {t("workshop.apply")}
            </button>
          </>
        ) : (
          <span className="text-xs text-text-muted flex-1">
            {t("workshop.no_presets")} <Link href="/workshop" className="text-primary hover:underline">{t("workshop.title")}</Link>
          </span>
        )}
        <button type="button" onClick={() => void saveAsPreset()} className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold cursor-pointer hover:border-primary/40">
          {t("workshop.save_as_preset")}
        </button>
      </div>
      {notice && <p role="status" className="text-xs text-success">{notice}</p>}
    </div>
  );
}
