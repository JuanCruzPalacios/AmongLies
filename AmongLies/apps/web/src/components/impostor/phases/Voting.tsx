"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { ImpostorPlayerView, Room, GameAction } from "@amonglies/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Avatar, Button } from "@/components/ui";

interface Props {
  gameState: ImpostorPlayerView;
  sendAction: (action: GameAction) => void;
  room: Room;
  myId: string;
}

export function Voting({ gameState, sendAction, room, myId }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(gameState.settings.votingTimeSeconds);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const votablePlayers = room.players.filter((p) => p.id !== myId);

  function handleVote() {
    if (!selected || gameState.hasVoted) return;
    sendAction({ type: "vote", payload: selected });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold text-danger mb-2">
          {t("game.impostor.vote")}
        </h2>
        <p className="text-text-secondary text-sm">
          {t("game.impostor.vote_for")}
        </p>
        <span className={`font-mono text-lg font-bold mt-2 inline-block ${timeLeft < 10 ? "text-danger" : "text-warning"}`}>
          {timeLeft}s
        </span>
      </div>

      {gameState.hasVoted ? (
        <div className="bg-bg-surface border border-border rounded-2xl p-8 text-center">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-text-secondary">Voto registrado. Esperando a los demas...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {votablePlayers.map((player) => (
              <motion.button
                key={player.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelected(player.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  selected === player.id
                    ? "border-danger bg-danger/10 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                    : "border-border bg-bg-surface hover:border-danger/40"
                }`}
              >
                <Avatar avatarId={player.avatarId} size="lg" />
                <span className="text-sm font-medium">{player.nickname}</span>
              </motion.button>
            ))}
          </div>

          <div className="flex justify-center">
            <Button
              variant="danger"
              size="lg"
              onClick={handleVote}
              disabled={!selected}
            >
              Votar
            </Button>
          </div>
        </>
      )}
    </motion.div>
  );
}
