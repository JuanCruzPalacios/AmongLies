"use client";

import { useEffect, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import type { GameView, GameAction } from "@amonglies/shared";

export function useGame() {
  const [gameState, setGameState] = useState<GameView | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.on("game:state-update", setGameState);
    return () => {
      socket.off("game:state-update", setGameState);
    };
  }, []);

  const sendAction = useCallback((action: GameAction) => {
    getSocket().emit("game:action", action);
  }, []);

  const resetGame = useCallback(() => setGameState(null), []);

  return { gameState, sendAction, resetGame };
}
