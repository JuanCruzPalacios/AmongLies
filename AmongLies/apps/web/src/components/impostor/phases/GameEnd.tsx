"use client";

import { motion } from "framer-motion";
import type { ImpostorPlayerView, Room, RoundResult } from "@amonglies/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui";

interface Props {
  gameState: ImpostorPlayerView;
  room: Room;
  results: unknown;
  onBackToLobby: () => void;
}

export function GameEnd({ gameState, room, results, onBackToLobby }: Props) {
  const { t } = useTranslation();

  const roundResults = (results as RoundResult[]) || gameState.results;
  const playersWins = roundResults.filter((r) => r.winner === "players").length;
  const impostorWins = roundResults.filter((r) => r.winner === "impostor").length;
  const totalRounds = roundResults.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-6"
    >
      <div className="bg-bg-surface border border-border rounded-3xl p-8">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="font-display text-3xl font-bold mb-2">
          {t("game.impostor.game_over")}
        </h2>

        {/* Score summary */}
        <div className="flex justify-center gap-8 my-6">
          <div className="text-center">
            <p className="text-4xl font-bold text-success">{playersWins}</p>
            <p className="text-xs text-text-muted uppercase tracking-wider mt-1">Jugadores</p>
          </div>
          <div className="text-text-muted text-2xl font-bold self-center">vs</div>
          <div className="text-center">
            <p className="text-4xl font-bold text-accent">{impostorWins}</p>
            <p className="text-xs text-text-muted uppercase tracking-wider mt-1">Impostores</p>
          </div>
        </div>

        {/* Round by round */}
        <div className="space-y-2 mb-6">
          {roundResults.map((result, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-4 py-2 rounded-xl text-sm ${
                result.winner === "players" ? "bg-success/10" : "bg-accent/10"
              }`}
            >
              <span className="text-text-secondary">Ronda {result.round}</span>
              <span className="font-mono text-primary">{result.word}</span>
              <span className={result.winner === "players" ? "text-success" : "text-accent"}>
                {result.winner === "players" ? "Jugadores" : "Impostor"}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-3">
          <Button size="lg" onClick={onBackToLobby}>
            {t("game.impostor.back_to_lobby")}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
