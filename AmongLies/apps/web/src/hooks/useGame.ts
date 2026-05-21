"use client";

import { useEffect, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import type { ImpostorPlayerView, GameAction } from "@amonglies/shared";

export function useGame() {
  const [gameState, setGameState] = useState<ImpostorPlayerView | null>(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [gameResults, setGameResults] = useState<unknown>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on("game:state-update", (state) => {
      setGameState(state);
      setGameEnded(false);
    });

    socket.on("game:phase-change", ({ phase }) => {
      if (phase === "game-end") {
        setGameEnded(true);
      }
    });

    socket.on("game:ended", ({ results }) => {
      setGameResults(results);
      setGameEnded(true);
    });

    return () => {
      socket.off("game:state-update");
      socket.off("game:phase-change");
      socket.off("game:ended");
    };
  }, []);

  const sendAction = useCallback((action: GameAction) => {
    const socket = getSocket();
    socket.emit("game:action", action);
  }, []);

  const resetGame = useCallback(() => {
    setGameState(null);
    setGameEnded(false);
    setGameResults(null);
  }, []);

  return { gameState, gameEnded, gameResults, sendAction, resetGame };
}
