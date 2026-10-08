"use client";

import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GameView, Room, GameAction } from "@amonglies/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Avatar } from "@/components/ui";

interface Props {
  gameState: GameView;
  room: Room;
  sendAction: (action: GameAction) => void;
  myId: string;
  summary?: ReactNode;
}

export function Discussion({ gameState, room, sendAction, myId, summary }: Props) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState(gameState.settings.discussionTimeSeconds);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = gameState.settings.discussionTimeSeconds > 0
    ? timeLeft / gameState.settings.discussionTimeSeconds
    : 0;

  const skipVotes = gameState.skipDiscussionVotes ?? [];
  const activePlayers = room.players.filter((p) => !gameState.eliminatedPlayerIds.includes(p.id));
  const hasVotedSkip = skipVotes.includes(myId);
  const amEliminated = gameState.eliminatedPlayerIds.includes(myId);

  const skipVoters = skipVotes
    .map((id) => room.players.find((p) => p.id === id))
    .filter(Boolean);

  function handleSkip() {
    sendAction({ type: "skip-discussion" });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Eliminated banner */}
      <AnimatePresence>
        {amEliminated && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-danger/15 border-2 border-danger/50 rounded-2xl px-5 py-4 text-center"
          >
            <div className="text-3xl mb-1">👻</div>
            <p className="font-display font-bold text-danger text-lg">Fuiste eliminado</p>
            <p className="text-text-muted text-sm mt-1">Solo podés observar la discusión</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-bg-surface border border-border rounded-3xl p-6">
        <h2 className="font-display text-2xl font-bold text-warning text-center mb-5">
          {t("game.impostor.discussion")}
        </h2>

        {/* Timer */}
        <div className="relative w-32 h-32 mx-auto mb-5">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--color-bg-surface-light)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke={timeLeft < 10 ? "var(--color-danger)" : "var(--color-warning)"}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 54}`}
              strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress)}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-mono text-3xl font-bold ${timeLeft < 10 ? "text-danger" : "text-warning"}`}>
              {minutes}:{seconds.toString().padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Skip discussion — prominent button */}
        {!amEliminated && (
          <div className="mb-5">
            <button
              onClick={handleSkip}
              disabled={hasVotedSkip}
              className={`w-full py-3 px-4 rounded-2xl font-display font-bold text-sm transition-all border-2 cursor-pointer ${
                hasVotedSkip
                  ? "bg-warning/20 border-warning/50 text-warning cursor-default"
                  : "bg-bg-surface-light border-warning/40 text-warning hover:bg-warning/15 hover:border-warning active:scale-95"
              }`}
            >
              {hasVotedSkip ? "✓ Votaste por saltear" : "⏭ Saltear discusión"}
            </button>
            <AnimatePresence>
              {skipVotes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 flex items-center gap-2 justify-center"
                >
                  <div className="flex -space-x-2">
                    {skipVoters.map((p) => (
                      <Avatar key={p!.id} avatarId={p!.avatarId} size="sm" />
                    ))}
                  </div>
                  <p className="text-text-muted text-xs">
                    {skipVotes.length}/{activePlayers.length} quieren saltear
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Resumen de la ronda (pistas, tiempos…): lo pasa cada juego */}
        {summary && <div className="border-t border-border pt-4">{summary}</div>}
      </div>
    </motion.div>
  );
}
