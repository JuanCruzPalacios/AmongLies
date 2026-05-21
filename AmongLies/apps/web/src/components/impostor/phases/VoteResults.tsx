"use client";

import { motion } from "framer-motion";
import type { ImpostorPlayerView, Room } from "@amonglies/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Avatar } from "@/components/ui";

interface Props {
  gameState: ImpostorPlayerView;
  room: Room;
}

export function VoteResults({ gameState, room }: Props) {
  const { t } = useTranslation();

  const lastResult = gameState.results[gameState.results.length - 1];
  if (!lastResult) return null;

  const votedOut = lastResult.votedOutId
    ? room.players.find((p) => p.id === lastResult.votedOutId)
    : null;

  const wasImpostor = votedOut && lastResult.impostorIds.includes(votedOut.id);
  const impostors = lastResult.impostorIds
    .map((id) => room.players.find((p) => p.id === id))
    .filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6"
    >
      <div className={`rounded-3xl p-8 border-2 ${
        lastResult.winner === "players"
          ? "bg-success/10 border-success"
          : "bg-accent/10 border-accent"
      }`}>
        {/* Who was voted out */}
        {votedOut ? (
          <div className="mb-6">
            <Avatar avatarId={votedOut.avatarId} size="xl" />
            <h3 className="font-display text-2xl font-bold mt-3">
              {votedOut.nickname}
            </h3>
            <p className={`font-display text-lg mt-1 ${wasImpostor ? "text-success" : "text-danger"}`}>
              {wasImpostor
                ? t("game.impostor.was_impostor")
                : t("game.impostor.was_not_impostor")
              }
            </p>
          </div>
        ) : (
          <div className="mb-6">
            <div className="text-5xl mb-2">🤷</div>
            <p className="text-text-secondary">Empate - nadie fue eliminado</p>
          </div>
        )}

        {/* Winner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-4"
        >
          <p className={`font-display text-xl font-bold ${
            lastResult.winner === "players" ? "text-success" : "text-accent"
          }`}>
            {lastResult.winner === "players"
              ? t("game.impostor.players_win")
              : t("game.impostor.impostor_wins")
            }
          </p>
        </motion.div>

        {/* Reveal impostors */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="pt-4 border-t border-border/50"
        >
          <p className="text-text-muted text-xs mb-2 uppercase tracking-wider">Impostor(es)</p>
          <div className="flex justify-center gap-3 mb-4">
            {impostors.map((p) => (
              <div key={p!.id} className="flex items-center gap-2 bg-accent/10 rounded-lg px-3 py-1.5">
                <Avatar avatarId={p!.avatarId} size="sm" />
                <span className="text-sm font-medium text-accent">{p!.nickname}</span>
              </div>
            ))}
          </div>
          <p className="text-text-secondary text-sm">
            {t("game.impostor.word_was")}{" "}
            <span className="font-bold text-primary">{lastResult.word}</span>
          </p>
        </motion.div>

        {/* Vote breakdown */}
        {Object.keys(gameState.votes).length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="mt-4 pt-4 border-t border-border/50"
          >
            <p className="text-text-muted text-xs mb-2 uppercase tracking-wider">Votos</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {Object.entries(gameState.votes).map(([voterId, votedId]) => {
                const voter = room.players.find((p) => p.id === voterId);
                const voted = room.players.find((p) => p.id === votedId);
                return (
                  <span key={voterId} className="text-xs bg-bg-surface-light rounded-lg px-2 py-1">
                    {voter?.nickname} → {voted?.nickname}
                  </span>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
