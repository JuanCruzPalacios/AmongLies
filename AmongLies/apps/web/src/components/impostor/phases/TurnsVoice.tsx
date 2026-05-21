"use client";

import { motion } from "framer-motion";
import type { ImpostorPlayerView, Room, GameAction } from "@amonglies/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Avatar, Button } from "@/components/ui";
import { usePlayerStore } from "@/stores/playerStore";

interface Props {
  gameState: ImpostorPlayerView;
  sendAction: (action: GameAction) => void;
  room: Room;
  myId: string;
}

export function TurnsVoice({ gameState, sendAction, room, myId }: Props) {
  const { t } = useTranslation();
  const isAdmin = room.adminId === myId;

  const currentPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
  const currentPlayer = room.players.find((p) => p.id === currentPlayerId);

  function handleReady() {
    sendAction({ type: "ready" });
  }

  function handleAdvance() {
    sendAction({ type: "advance" });
  }

  return (
    <div className="space-y-6">
      {/* Big turn indicator */}
      <motion.div
        key={currentPlayerId}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center bg-bg-surface border border-border rounded-3xl p-8"
      >
        <Avatar avatarId={currentPlayer?.avatarId || "fox"} size="xl" />
        <h2 className="font-display text-2xl font-bold mt-4 text-primary">
          {currentPlayer?.nickname}
        </h2>
        {gameState.isMyTurn ? (
          <p className="text-accent text-lg font-display mt-2">
            {t("game.voice.your_turn_speak")}
          </p>
        ) : (
          <p className="text-text-secondary mt-2">
            {t("game.impostor.waiting_turn", { player: currentPlayer?.nickname || "" })}
          </p>
        )}
      </motion.div>

      {/* Turn list with checks */}
      <div className="bg-bg-surface border border-border rounded-2xl p-4">
        <div className="flex flex-wrap gap-3 justify-center">
          {gameState.turnOrder.map((playerId, idx) => {
            const player = room.players.find((p) => p.id === playerId);
            const isDone = idx < gameState.currentTurnIndex;
            const isCurrent = idx === gameState.currentTurnIndex;

            return (
              <div
                key={playerId}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                  isCurrent ? "bg-primary/15 border border-primary/30" : ""
                } ${isDone ? "opacity-50" : ""} ${!isDone && !isCurrent ? "opacity-30" : ""}`}
              >
                <Avatar avatarId={player?.avatarId || "fox"} size="sm" />
                <span className="text-xs font-medium">{player?.nickname}</span>
                {isDone && <span className="text-success">✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-center gap-3">
        {gameState.isMyTurn && (
          <Button size="lg" onClick={handleReady}>
            {t("game.voice.done")}
          </Button>
        )}
        {isAdmin && !gameState.isMyTurn && (
          <Button variant="secondary" onClick={handleAdvance}>
            {t("game.voice.next")}
          </Button>
        )}
      </div>
    </div>
  );
}
