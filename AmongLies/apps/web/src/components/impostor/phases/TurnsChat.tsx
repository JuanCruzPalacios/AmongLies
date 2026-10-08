"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ImpostorPlayerView, Room, GameAction } from "@amonglies/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Avatar, Button, Input } from "@/components/ui";

interface Props {
  gameState: ImpostorPlayerView;
  sendAction: (action: GameAction) => void;
  room: Room;
  myId: string;
}

export function TurnsChat({ gameState, sendAction, room, myId }: Props) {
  const { t } = useTranslation();
  const [word, setWord] = useState("");
  const [wordError, setWordError] = useState("");

  const currentPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
  const currentPlayer = room.players.find((p) => p.id === currentPlayerId);

  function handleSubmit() {
    const trimmed = word.trim();
    if (!trimmed) return;

    const alreadyUsed = gameState.wordsUsed.some(
      (w) => w.word.toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyUsed) {
      setWordError(t("game.impostor.error.word_used"));
      return;
    }

    if (gameState.secretWord && trimmed.toLowerCase() === gameState.secretWord.toLowerCase()) {
      setWordError(t("game.impostor.error.word_secret"));
      return;
    }

    setWordError("");
    sendAction({ type: "submit-word", payload: trimmed });
    setWord("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="space-y-4">
      {/* Turn order with words */}
      <div className="bg-bg-surface border border-border rounded-2xl p-4">
        <div className="space-y-2">
          {gameState.turnOrder.map((playerId, idx) => {
            const player = room.players.find((p) => p.id === playerId);
            const wordEntry = gameState.wordsUsed.find((w) => w.playerId === playerId);
            const isCurrent = idx === gameState.currentTurnIndex;
            const isPast = idx < gameState.currentTurnIndex;

            return (
              <motion.div
                key={playerId}
                initial={isCurrent ? { x: -10, opacity: 0 } : {}}
                animate={{ x: 0, opacity: 1 }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                  isCurrent
                    ? "bg-primary/15 border border-primary/30"
                    : isPast
                    ? "opacity-60"
                    : "opacity-40"
                }`}
              >
                <Avatar avatarId={player?.avatarId || "fox"} size="sm" />
                <span className={`text-sm font-medium flex-1 min-w-0 truncate ${isCurrent ? "text-primary" : ""}`}>
                  {player?.nickname}
                  {playerId === myId && ` ${t("lobby.you")}`}
                </span>
                {wordEntry && (
                  <span className="text-sm font-mono bg-bg-surface-light px-2 py-1 rounded min-w-0 max-w-[60%] text-right whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {wordEntry.word}
                  </span>
                )}
                {isCurrent && !wordEntry && (
                  <span className="text-xs text-primary animate-pulse">●</span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Input for current player */}
      {gameState.isMyTurn ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/10 border border-primary/30 rounded-2xl p-4 space-y-3"
        >
          <p className="text-primary font-display font-bold text-center">
            {t("game.impostor.your_turn")}
          </p>
          <div className="flex gap-2">
            <Input
              placeholder={t("game.impostor.word_placeholder")}
              value={word}
              onChange={(e) => { setWord(e.target.value); setWordError(""); }}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button onClick={handleSubmit} disabled={!word.trim()}>
              {t("game.impostor.submit_word")}
            </Button>
          </div>
          <AnimatePresence>
            {wordError && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-danger text-sm text-center"
              >
                {wordError}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="text-center py-4">
          <p className="text-text-secondary text-sm">
            {t("game.impostor.waiting_turn", { player: currentPlayer?.nickname || "..." })}
          </p>
        </div>
      )}
    </div>
  );
}
