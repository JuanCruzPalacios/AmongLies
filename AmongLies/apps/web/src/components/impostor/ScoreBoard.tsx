"use client";

import type { Room } from "@amonglies/shared";
import { Avatar } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  room: Room;
  scores: Record<string, number>;
  /** Puntos sumados en la última partida (se muestran como "+N"). */
  gained?: Record<string, number>;
  /** Podio con los tres primeros (pantalla de fin del juego). */
  podium?: boolean;
}

const MEDALS = ["🥇", "🥈", "🥉"];

/** Ranking por puntos acumulados. */
export function ScoreBoard({ room, scores, gained, podium = false }: Props) {
  const { t } = useTranslation();
  const ranking = room.players
    .map((player) => ({ player, points: scores[player.id] ?? 0 }))
    .sort((a, b) => b.points - a.points);

  return (
    <div className="bg-bg-surface border border-border rounded-2xl p-4 space-y-3">
      <h3 className="font-display font-bold text-xs text-text-secondary uppercase tracking-widest text-center">
        {t("game.score.title")}
      </h3>

      {podium && ranking.length > 0 && (
        <div className="flex justify-center items-end gap-3 pb-2">
          {[1, 0, 2].map((place) => {
            const entry = ranking[place];
            if (!entry) return null;
            return (
              <div key={entry.player.id} className="flex flex-col items-center gap-1">
                <span className="text-2xl">{MEDALS[place]}</span>
                <Avatar avatarId={entry.player.avatarId} size={place === 0 ? "lg" : "md"} />
                <span className="text-sm font-semibold max-w-24 truncate">{entry.player.nickname}</span>
                <span className="text-xs text-primary font-mono">{t("game.score.points", { n: entry.points })}</span>
              </div>
            );
          })}
        </div>
      )}

      <ol className="space-y-1.5">
        {ranking.map(({ player, points }, index) => (
          <li key={player.id} className="flex items-center gap-3 px-2 py-1.5 rounded-xl bg-bg-surface-light">
            <span className="w-5 text-center text-xs text-text-muted font-mono">{index + 1}</span>
            <Avatar avatarId={player.avatarId} size="sm" />
            <span className="flex-1 text-sm truncate">{player.nickname}</span>
            {gained && (gained[player.id] ?? 0) > 0 && (
              <span className="text-xs text-success font-mono">+{gained[player.id]}</span>
            )}
            <span className="text-sm font-mono font-bold text-primary w-14 text-right">
              {t("game.score.points", { n: points })}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
