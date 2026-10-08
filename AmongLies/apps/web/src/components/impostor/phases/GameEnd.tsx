"use client";

import { motion } from "framer-motion";
import type { ImpostorPlayerView, Room, RoundResult } from "@amonglies/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui";
import { ScoreBoard } from "../ScoreBoard";

interface Props {
  gameState: ImpostorPlayerView;
  room: Room;
  onBackToLobby: () => void;
}

export function GameEnd({ gameState, room, onBackToLobby }: Props) {
  const { t } = useTranslation();

  // Cada partida terminada con su ganador (calculado en el servidor) y sus rondas
  const partidaResults = gameState.partidaResults.map((p) => ({
    partida: p.partida,
    playersWon: p.winner === "players",
    rounds: gameState.results.filter((r: RoundResult) => r.partida === p.partida),
  }));

  const playersPartidas = partidaResults.filter((p) => p.playersWon).length;
  const impostorPartidas = partidaResults.length - playersPartidas;
  const winner = playersPartidas >= impostorPartidas ? "players" : "impostor";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-5 pb-8"
    >
      {/* Winner banner */}
      <div className={`rounded-3xl p-8 border-2 ${
        winner === "players"
          ? "bg-success/10 border-success"
          : "bg-accent/10 border-accent"
      }`}>
        <div className="text-6xl mb-3">
          {winner === "players" ? "🏆" : "🕵️"}
        </div>
        <h2 className="font-display text-4xl font-black mb-1">
          {winner === "players"
            ? t("game.impostor.players_win")
            : t("game.impostor.impostor_wins")}
        </h2>
        <p className="text-text-secondary text-sm">
          {t("game.impostor.game_over")}
        </p>

        {/* Score por partidas */}
        {gameState.totalPartidas > 1 && (
          <div className="flex justify-center gap-10 mt-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-success">{playersPartidas}</p>
              <p className="text-xs text-text-muted uppercase tracking-wider mt-1">Jugadores</p>
            </div>
            <div className="text-text-muted text-2xl font-bold self-center">vs</div>
            <div className="text-center">
              <p className="text-4xl font-bold text-accent">{impostorPartidas}</p>
              <p className="text-xs text-text-muted uppercase tracking-wider mt-1">Impostor</p>
            </div>
          </div>
        )}
      </div>

      {/* Historial por partida */}
      <div className="space-y-3">
        {partidaResults.map(({ partida, rounds, playersWon }) => {
          const impostorIds = gameState.partidaResults.find((p) => p.partida === partida)?.impostorIds ?? [];
          const impostorNames = impostorIds
            .map((id) => room.players.find((p) => p.id === id)?.nickname)
            .filter(Boolean)
            .join(", ");

          return (
            <div key={partida} className="bg-bg-surface border border-border rounded-2xl overflow-hidden">
              {/* Partida header */}
              <div className={`px-4 py-2.5 flex items-center justify-between ${
                playersWon ? "bg-success/10" : "bg-accent/10"
              }`}>
                <span className="font-display font-bold text-sm">
                  Partida {partida}
                </span>
                <span className={`text-xs font-bold ${playersWon ? "text-success" : "text-accent"}`}>
                  {playersWon ? "Jugadores ganaron" : "Impostor ganó"}
                </span>
                <span className="text-text-muted text-xs">
                  🕵️ {impostorNames}
                </span>
              </div>

              {/* Rounds dentro de la partida */}
              <div className="divide-y divide-border">
                {rounds.map((r, i) => {
                  const votedOut = r.votedOutId
                    ? room.players.find((p) => p.id === r.votedOutId)?.nickname
                    : null;
                  return (
                    <div key={i} className="flex items-center justify-between px-4 py-2 text-xs">
                      <span className="text-text-muted">Ronda {r.ronda}</span>
                      <span className="font-mono text-primary">{r.word}</span>
                      <span className="text-text-secondary">
                        {r.winner === "tie"
                          ? "Empate"
                          : votedOut
                          ? `${votedOut} eliminado`
                          : "—"}
                      </span>
                      <span className={
                        r.winner === "players" ? "text-success font-semibold"
                        : r.winner === "tie" ? "text-text-muted"
                        : "text-accent font-semibold"
                      }>
                        {r.winner === "players" ? "✓" : r.winner === "tie" ? "=" : "✗"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <ScoreBoard room={room} scores={gameState.scores} podium />

      <Button size="lg" className="w-full" onClick={onBackToLobby}>
        {t("game.impostor.back_to_lobby")}
      </Button>
    </motion.div>
  );
}
