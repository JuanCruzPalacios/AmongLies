"use client";

import type { Room, TimeEntry } from "@amonglies/shared";
import { Avatar } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { formatSeconds } from "@/components/deduction/roundAnswer";

/** Tiempos ya revelados de la ronda, en orden de turno. */
export function TimesBoard({ times, room }: { times: TimeEntry[]; room: Room }) {
  const { t, locale } = useTranslation();
  if (times.length === 0) return null;
  return (
    <div>
      <p className="text-text-muted text-xs mb-3 uppercase tracking-wider text-center">{t("game.time.times")}</p>
      <div className="space-y-1.5">
        {times.map((entry) => {
          const player = room.players.find((p) => p.id === entry.playerId);
          return (
            <div key={entry.playerId} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-surface-light">
              <Avatar avatarId={player?.avatarId || "fox"} size="sm" />
              <span className="text-sm text-text-secondary flex-1">{player?.nickname}</span>
              <span className={`font-mono text-sm font-semibold ${entry.timedOut ? "text-warning" : "text-primary"}`}>
                {entry.timedOut ? t("game.time.timed_out") : formatSeconds(entry.ms, locale)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
