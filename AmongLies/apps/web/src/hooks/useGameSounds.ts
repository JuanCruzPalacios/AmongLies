"use client";

import { useEffect, useRef } from "react";
import type { GameView } from "@amonglies/shared";
import { playSfx } from "@/lib/sound";

/** Efectos de la partida: tu turno, votación, resultados, victoria/derrota y expulsión. */
export function useGameSounds(gameState: GameView, myId: string): void {
  const prev = useRef<{ phase: string; myTurn: boolean; eliminated: boolean } | null>(null);

  useEffect(() => {
    const eliminated = gameState.eliminatedPlayerIds.includes(myId);
    const before = prev.current;
    prev.current = { phase: gameState.phase, myTurn: gameState.isMyTurn, eliminated };
    if (!before) return;

    if (gameState.isMyTurn && !before.myTurn) playSfx("turn");
    if (eliminated && !before.eliminated) playSfx("eliminated");
    if (gameState.phase === before.phase) return;

    switch (gameState.phase) {
      case "voting":
        playSfx("vote");
        break;
      case "vote-results":
        playSfx("reveal");
        break;
      case "partida-end":
      case "game-end": {
        // Ganó mi equipo: los impostores si soy impostor, los inocentes si no.
        const lastWinner = gameState.partidaResults.at(-1)?.winner;
        if (lastWinner) playSfx((lastWinner === "impostor") === gameState.isImpostor ? "win" : "lose");
        break;
      }
    }
  }, [gameState, myId]);
}
