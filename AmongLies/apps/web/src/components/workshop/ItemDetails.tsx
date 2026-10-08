"use client";

import { getGameDefinition, type WorkshopItem } from "@amonglies/shared";
import { useTranslation } from "@/hooks/useTranslation";

/** El contenido de un ítem: las palabras de una lista o los ajustes de un preset. */
export function ItemDetails({ item }: { item: WorkshopItem }) {
  const { t, locale } = useTranslation();
  if ("words" in item.content) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {item.content.words.map((w) => (
          <span key={w} className="px-2 py-0.5 rounded-md bg-bg-surface text-xs border border-border">
            {w}
          </span>
        ))}
      </div>
    );
  }
  const def = getGameDefinition(item.content.gameId);
  if (!def) return null;
  const settings = item.content.settings;
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
      {def.settingsSchema.map((s) => {
        const value = settings[s.key];
        const shown =
          s.type === "boolean"
            ? value === true
              ? t("workshop.yes")
              : t("workshop.no")
            : s.type === "select"
              ? (s.options?.find((o) => o.value === value)?.label[locale] ?? String(value))
              : value === 0 && s.zeroLabel
                ? s.zeroLabel[locale]
                : String(value);
        return (
          <div key={s.key} className="flex justify-between gap-2 border-b border-border/40 py-1">
            <dt className="text-text-muted">{s.label[locale]}</dt>
            <dd className="font-mono text-primary">{shown}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Íconos de los juegos compatibles. */
export function GameIcons({ games }: { games: string[] }) {
  const { locale } = useTranslation();
  return (
    <span className="flex gap-1">
      {games.map((g) => {
        const def = getGameDefinition(g);
        return def ? (
          <span key={g} title={def.name[locale]} aria-label={def.name[locale]}>
            {def.emoji}
          </span>
        ) : null;
      })}
    </span>
  );
}
