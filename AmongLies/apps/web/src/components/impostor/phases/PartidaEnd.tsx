"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ImpostorPlayerView, Room, GameAction } from "@amonglies/shared";
import { Avatar } from "@/components/ui";

const PARTIDA_END_SECONDS = 15;

interface Props {
  gameState: ImpostorPlayerView;
  room: Room;
  sendAction: (action: GameAction) => void;
  myId: string;
}

export function PartidaEnd({ gameState, room, sendAction, myId }: Props) {
  const [timeLeft, setTimeLeft] = useState(PARTIDA_END_SECONDS);

  useEffect(() => {
    setTimeLeft(PARTIDA_END_SECONDS);
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState.partida]);

  const partidaResults = gameState.results.filter((r) => r.partida === gameState.partida);
  const winner = gameState.gameWinner;
  const skipVotes = gameState.partidaEndSkipVotes ?? [];
  const hasVotedSkip = skipVotes.includes(myId);
  const totalPlayers = room.players.length;

  // Impostors are now revealed (partida-end phase)
  const lastResult = partidaResults[partidaResults.length - 1];
  const impostorIds = lastResult?.impostorIds ?? [];
  const impostors = impostorIds
    .map((id) => room.players.find((p) => p.id === id))
    .filter(Boolean);

  const eliminated = gameState.eliminatedPlayerIds
    .map((id) => room.players.find((p) => p.id === id))
    .filter(Boolean);

  function handleSkip() {
    sendAction({ type: "skip-partida-end" });
  }

  const isPlayersWin = winner === "players";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-4"
    >
      {/* Result banner */}
      <div className={`rounded-3xl p-6 border-2 text-center ${
        isPlayersWin ? "bg-success/10 border-success" : "bg-accent/10 border-accent"
      }`}>
        <div className="text-5xl mb-3">{isPlayersWin ? "🏆" : "🕵️"}</div>
        <p className="text-text-muted text-xs uppercase tracking-widest mb-1">
          Partida {gameState.partida} terminada
        </p>
        <h2 className={`font-display text-3xl font-black mb-4 ${
          isPlayersWin ? "text-success" : "text-accent"
        }`}>
          {isPlayersWin ? "¡Jugadores ganan!" : "¡El impostor gana!"}
        </h2>

        {/* Impostors revealed */}
        {impostors.length > 0 && (
          <div className="mb-4">
            <p className="text-text-muted text-xs mb-2 uppercase tracking-wider">
              {impostors.length === 1 ? "El impostor era" : "Los impostores eran"}
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              {impostors.map((p) => (
                <div key={p!.id} className="flex items-center gap-2 bg-accent/15 border border-accent/30 rounded-xl px-3 py-2">
                  <Avatar avatarId={p!.avatarId} size="md" />
                  <span className="font-display font-bold text-accent">{p!.nickname}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Eliminated players */}
        {eliminated.length > 0 && (
          <div className="mb-4">
            <p className="text-text-muted text-xs mb-2 uppercase tracking-wider">Eliminados</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {eliminated.map((p) => (
                <div key={p!.id} className="flex items-center gap-1.5 bg-bg-surface-light rounded-lg px-2.5 py-1.5">
                  <Avatar avatarId={p!.avatarId} size="sm" />
                  <span className="text-sm text-text-secondary">{p!.nickname}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Round history */}
        <div className="space-y-1 mb-4">
          <p className="text-text-muted text-xs uppercase tracking-wider mb-2">Rondas de esta partida</p>
          {partidaResults.map((r, i) => (
            <div key={i} className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs ${
              r.winner === "players" ? "bg-success/10"
              : r.winner === "tie" ? "bg-bg-surface-light"
              : "bg-accent/10"
            }`}>
              <span className="text-text-muted">Ronda {r.ronda}</span>
              <span className="font-mono text-primary">{r.word}</span>
              <span className={
                r.winner === "players" ? "text-success font-semibold"
                : r.winner === "tie" ? "text-text-muted"
                : "text-accent font-semibold"
              }>
                {r.winner === "players" ? "Impostor atrapado" : r.winner === "tie" ? "Empate" : "Impostor libre"}
              </span>
            </div>
          ))}
        </div>

        {/* Next partida info */}
        <p className="text-text-secondary text-sm">
          Siguiente partida en{" "}
          <span className={`font-mono font-bold ${timeLeft < 5 ? "text-danger" : "text-warning"}`}>
            {timeLeft}s
          </span>
        </p>
      </div>

      {/* Skip button */}
      <button
        onClick={handleSkip}
        disabled={hasVotedSkip}
        className={`w-full py-3 px-4 rounded-2xl font-display font-bold text-sm transition-all border-2 cursor-pointer ${
          hasVotedSkip
            ? "bg-primary/20 border-primary/50 text-primary cursor-default"
            : "bg-bg-surface-light border-primary/40 text-primary hover:bg-primary/15 hover:border-primary active:scale-95"
        }`}
      >
        {hasVotedSkip ? "✓ Querés continuar" : "⏭ Continuar ya"}
      </button>

      <AnimatePresence>
        {skipVotes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-center gap-2"
          >
            <div className="flex -space-x-2">
              {skipVotes
                .map((id) => room.players.find((p) => p.id === id))
                .filter(Boolean)
                .map((p) => (
                  <Avatar key={p!.id} avatarId={p!.avatarId} size="sm" />
                ))}
            </div>
            <p className="text-text-muted text-xs">
              {skipVotes.length}/{totalPlayers} quieren continuar
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
