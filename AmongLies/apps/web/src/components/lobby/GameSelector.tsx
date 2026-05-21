"use client";

import { ALL_GAMES } from "@amonglies/shared";
import { Card } from "@/components/ui";
import { useRoomStore } from "@/stores/roomStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useTranslation } from "@/hooks/useTranslation";
import { getSocket } from "@/lib/socket";

export function GameSelector() {
  const { t, locale } = useTranslation();
  const room = useRoomStore((s) => s.room);
  const myId = usePlayerStore((s) => s.playerId);

  if (!room) return null;

  const isAdmin = room.adminId === myId;

  function handleSelect(gameId: string) {
    if (!isAdmin) return;
    getSocket().emit("game:select", { gameId });
  }

  return (
    <div>
      <h3 className="font-display font-bold text-sm text-text-secondary mb-3 uppercase tracking-wider">
        {t("lobby.select_game")}
      </h3>
      <div className="grid gap-3">
        {ALL_GAMES.map((game) => {
          const isSelected = room.selectedGameId === game.id;
          return (
            <Card
              key={game.id}
              hover={isAdmin}
              onClick={() => handleSelect(game.id)}
              className={`${
                isSelected
                  ? "border-primary bg-primary/10 shadow-[0_0_20px_var(--color-primary-glow)]"
                  : ""
              } ${!isAdmin ? "cursor-default" : ""}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center text-2xl">
                  🎭
                </div>
                <div className="flex-1">
                  <h4 className="font-display font-bold">{game.name[locale]}</h4>
                  <p className="text-text-secondary text-sm">{game.description[locale]}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs text-text-muted">
                      {game.minPlayers}+ players
                    </span>
                    <span className="text-xs text-text-muted">
                      {game.supportedModes.join(" / ")}
                    </span>
                  </div>
                </div>
                {isSelected && (
                  <div className="text-primary text-xl">✓</div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
