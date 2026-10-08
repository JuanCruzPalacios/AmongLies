"use client";

import { getGameDefinition, getWordListsForGame } from "@amonglies/shared";
import { useRoomStore } from "@/stores/roomStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useTranslation } from "@/hooks/useTranslation";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/authStore";
import { PresetTools, useMyWorkshop } from "./WorkshopLobbyTools";

/** Muestra los ajustes guardados en la sala. Sólo el admin puede cambiarlos (el servidor los valida). */
export function GameSettings() {
  const { t, locale } = useTranslation();
  const room = useRoomStore((s) => s.room);
  const myId = usePlayerStore((s) => s.playerId);
  const user = useAuthStore((s) => s.user);
  const myWorkshop = useMyWorkshop();

  const game = room?.selectedGameId ? getGameDefinition(room.selectedGameId) : undefined;
  if (!room || !game) return null;

  const isAdmin = room.adminId === myId;
  const settings = room.gameSettings;
  const wordLists = getWordListsForGame(game, room.settings.locale);
  const selectedWordLists = (settings.selectedWordLists as string[] | undefined) ?? [];
  // Listas del workshop: las que ya tiene la sala y, para el admin, las de su colección.
  const roomLocale = room.settings.locale;
  const customLists = new Map(
    room.customWordLists
      .filter((l) => l.locale === roomLocale && (!game.drawableWordsOnly || l.drawable))
      .map((l) => [l.id, { id: l.id, title: l.title, wordCount: l.wordCount }]),
  );
  if (isAdmin) {
    for (const item of myWorkshop.items) {
      if (item.kind !== "word_list" || item.locale !== roomLocale || !("words" in item.content)) continue;
      if (game.drawableWordsOnly && !item.drawable) continue;
      if (!customLists.has(item.id)) customLists.set(item.id, { id: item.id, title: item.title, wordCount: item.content.words.length });
    }
  }
  // Los demás jugadores sólo ven las del workshop que están elegidas.
  const visibleCustom = [...customLists.values()].filter((l) => isAdmin || selectedWordLists.includes(l.id));

  function updateSetting(key: string, value: unknown) {
    if (isAdmin) getSocket().emit("game:update-settings", { [key]: value });
  }

  function toggleWordList(listId: string) {
    const next = selectedWordLists.includes(listId)
      ? selectedWordLists.filter((id) => id !== listId)
      : [...selectedWordLists, listId];
    if (next.length === 0) return;
    updateSetting("selectedWordLists", next);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-bold text-sm text-text-secondary mb-3 uppercase tracking-wider">
          {t("lobby.game_settings")}
        </h3>
        <div className="space-y-4">
          {isAdmin && user && (
            <PresetTools room={room} presets={myWorkshop.items} onSaved={myWorkshop.reload} />
          )}
          {game.settingsSchema.map((schema) => {
            const value = settings[schema.key] ?? schema.default;
            return (
              <div key={schema.key}>
                <label className="text-sm text-text-secondary block mb-1">
                  {schema.label[locale]}
                </label>
                {schema.type === "number" && (
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={schema.min}
                      max={schema.max}
                      value={value as number}
                      onChange={(e) => updateSetting(schema.key, Number(e.target.value))}
                      disabled={!isAdmin}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-sm font-mono text-primary min-w-8 text-right">
                      {value === 0 && schema.zeroLabel ? schema.zeroLabel[locale] : (value as number)}
                    </span>
                  </div>
                )}
                {schema.type === "boolean" && (
                  <button
                    role="switch"
                    aria-checked={value === true}
                    onClick={() => updateSetting(schema.key, value !== true)}
                    disabled={!isAdmin}
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed ${
                      value === true ? "bg-primary" : "bg-bg-surface-light border border-border"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        value === true ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                )}
                {schema.type === "select" && (
                  <div className="flex gap-2 flex-wrap">
                    {schema.options?.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateSetting(schema.key, opt.value)}
                        disabled={!isAdmin}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                          value === opt.value
                            ? "bg-primary text-white"
                            : "bg-bg-surface-light text-text-secondary hover:text-text-primary border border-border"
                        } disabled:cursor-not-allowed`}
                      >
                        {opt.label[locale]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {game.usesWordLists && (
      <div>
        <h3 className="font-display font-bold text-sm text-text-secondary mb-3 uppercase tracking-wider">
          {t("lobby.word_lists")}
        </h3>
        {visibleCustom.length > 0 && (
          <>
            <p className="text-xs text-text-muted mb-2">{t("workshop.your_lists")}</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {visibleCustom.map((wl) => {
                const isSelected = selectedWordLists.includes(wl.id);
                return (
                  <button
                    key={wl.id}
                    onClick={() => toggleWordList(wl.id)}
                    disabled={!isAdmin}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer text-left ${
                      isSelected
                        ? "bg-accent/15 text-accent border border-accent/40"
                        : "bg-bg-surface-light text-text-secondary border border-border hover:border-accent/30"
                    } disabled:cursor-not-allowed`}
                  >
                    <span className="block truncate">🧩 {wl.title}</span>
                    <span className="text-xs text-text-muted">{t("lobby.words", { n: wl.wordCount })}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-2">
          {wordLists.map((wl) => {
            const isSelected = selectedWordLists.includes(wl.id);
            return (
              <button
                key={wl.id}
                onClick={() => toggleWordList(wl.id)}
                disabled={!isAdmin}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer text-left ${
                  isSelected
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "bg-bg-surface-light text-text-secondary border border-border hover:border-primary/30"
                } disabled:cursor-not-allowed`}
              >
                <span className="block">{wl.category[locale]}</span>
                <span className="text-xs text-text-muted">{t("lobby.words", { n: wl.words.length })}</span>
              </button>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}
