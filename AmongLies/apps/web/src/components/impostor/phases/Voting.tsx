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

  const votablePlayers = room.players.filter(
    (p) => p.id !== myId && !gameState.eliminatedPlayerIds.includes(p.id)
  );

  const amEliminated = gameState.eliminatedPlayerIds.includes(myId);
  const activePlayers = room.players.filter((p) => !gameState.eliminatedPlayerIds.includes(p.id));
  const votesIn = gameState.voteCount ?? 0;
  const votesNeeded = activePlayers.length;
  const votesPending = votesNeeded - votesIn;

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
        <h2 className="font-display text-2xl font-bold text-danger mb-1">
          {t("game.impostor.vote")}
        </h2>
        <p className="text-text-secondary text-sm">{t("game.impostor.vote_for")}</p>
        <span className={`font-mono text-lg font-bold mt-1 inline-block ${timeLeft < 10 ? "text-danger" : "text-warning"}`}>
          {timeLeft}s
        </span>

        {/* Vote progress */}
        <div className="mt-2 flex items-center justify-center gap-2">
          <div className="flex gap-1">
            {Array.from({ length: votesNeeded }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i < votesIn ? "bg-danger" : "bg-border"
                }`}
              />
            ))}
          </div>
          <span className="text-text-muted text-xs">
            {votesIn}/{votesNeeded} votaron
            {votesPending > 0 && ` · faltan ${votesPending}`}
          </span>
        </div>
      </div>

      {amEliminated ? (
        <div className="bg-bg-surface border border-border rounded-2xl p-8 text-center">
          <div className="text-4xl mb-2">👻</div>
          <p className="text-text-secondary">{t("game.impostor.eliminated_spectate")}</p>
        </div>
      ) : gameState.hasVoted ? (
        <div className="bg-bg-surface border border-border rounded-2xl p-8 text-center">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-text-secondary">{t("game.impostor.vote_registered")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {votablePlayers.map((player) => (
              <motion.div
                key={player.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelected(player.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setSelected(player.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                  selected === player.id
                    ? "border-danger bg-danger/10 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                    : "border-border bg-bg-surface hover:border-danger/40"
                }`}
              >
                <Avatar avatarId={player.avatarId} size="lg" />
                <span className="text-sm font-medium">{player.nickname}</span>
              </motion.div>
            ))}
          </div>

          <div className="flex justify-center">
            <Button variant="danger" size="lg" onClick={handleVote} disabled={!selected}>
              {t("game.impostor.vote_action")}
            </Button>
          </div>
        </>
      )}
    </motion.div>
  );
}
