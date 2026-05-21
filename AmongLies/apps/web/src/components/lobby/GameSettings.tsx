"use client";

import { useState, useEffect } from "react";
import { ALL_GAMES, getWordListsByLocale } from "@amonglies/shared";
import type { Locale } from "@amonglies/shared";
import { useRoomStore } from "@/stores/roomStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useTranslation } from "@/hooks/useTranslation";
import { getSocket } from "@/lib/socket";

export function GameSettings() {
  const { t, locale } = useTranslation();
  const room = useRoomStore((s) => s.room);
  const myId = usePlayerStore((s) => s.playerId);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [selectedWordLists, setSelectedWordLists] = useState<string[]>([]);

  const isAdmin = room?.adminId === myId;
  const game = ALL_GAMES.find((g) => g.id === room?.selectedGameId);
  const roomLocale = (room?.settings.locale || locale) as Locale;
  const wordLists = getWordListsByLocale(roomLocale);

  useEffect(() => {
    if (game) {
      const defaults: Record<string, unknown> = {};
      for (const schema of game.settingsSchema) {
        defaults[schema.key] = schema.default;
      }
      defaults["selectedWordLists"] = wordLists.map((wl) => wl.id);
      setSettings(defaults);
      setSelectedWordLists(wordLists.map((wl) => wl.id));
    }
  }, [game?.id, roomLocale]);

  if (!room || !game) return null;

  function updateSetting(key: string, value: unknown) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (isAdmin) {
      getSocket().emit("game:update-settings", { [key]: value });
    }
  }

  function toggleWordList(listId: string) {
    const next = selectedWordLists.includes(listId)
      ? selectedWordLists.filter((id) => id !== listId)
      : [...selectedWordLists, listId];
    if (next.length === 0) return;
    setSelectedWordLists(next);
    if (isAdmin) {
      getSocket().emit("game:update-settings", { selectedWordLists: next });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-bold text-sm text-text-secondary mb-3 uppercase tracking-wider">
          {t("lobby.game_settings")}
        </h3>
        <div className="space-y-4">
          {game.settingsSchema.map((schema) => (
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
                    value={(settings[schema.key] as number) ?? schema.default}
                    onChange={(e) => updateSetting(schema.key, Number(e.target.value))}
                    disabled={!isAdmin}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-sm font-mono text-primary w-8 text-right">
                    {(settings[schema.key] as number) ?? schema.default}
                  </span>
                </div>
              )}
              {schema.type === "select" && (
                <div className="flex gap-2 flex-wrap">
                  {schema.options?.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateSetting(schema.key, opt.value)}
                      disabled={!isAdmin}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        settings[schema.key] === opt.value
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
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-display font-bold text-sm text-text-secondary mb-3 uppercase tracking-wider">
          {t("lobby.word_lists")}
        </h3>
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
                <span className="text-xs text-text-muted">{wl.words.length} words</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
