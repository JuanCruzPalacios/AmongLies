"use client";

import { motion } from "framer-motion";
import { getDecider, type Room } from "@amonglies/shared";
import { Avatar, Button } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { getSocket } from "@/lib/socket";

interface Props {
  room: Room;
  myId: string;
}

/** Se muestra mientras la partida está en pausa porque falta alguien. */
export function PauseOverlay({ room, myId }: Props) {
  const { t } = useTranslation();
  const missing = room.players.filter((p) => !p.isConnected);
  const decider = getDecider(room);
  const iDecide = decider?.id === myId;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
    >
      <div className="w-full max-w-md bg-bg-surface border border-border rounded-3xl p-6 text-center space-y-5">
        <div>
          <div className="text-4xl mb-2">⏸️</div>
          <h2 className="font-display text-2xl font-bold">{t("game.paused.title")}</h2>
          <p className="text-text-secondary text-sm mt-1">{t("game.paused.waiting")}</p>
        </div>

        <div className="space-y-2">
          {missing.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-3 bg-bg-surface-light border border-border rounded-xl px-3 py-2"
            >
              <Avatar avatarId={player.avatarId} size="sm" />
              <span className="flex-1 text-left text-sm font-medium truncate">{player.nickname}</span>
              {iDecide && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => getSocket().emit("game:continue-without", { playerId: player.id })}
                >
                  {t("game.paused.continue_without")}
                </Button>
              )}
            </div>
          ))}
        </div>

        {!iDecide && decider && (
          <p className="text-text-muted text-xs">
            {t("game.paused.decider", { player: decider.nickname })}
          </p>
        )}
      </div>
    </motion.div>
  );
}
