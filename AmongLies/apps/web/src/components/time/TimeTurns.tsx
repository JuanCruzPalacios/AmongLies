"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { GameAction, Room, TimePlayerView } from "@amonglies/shared";
import { Avatar, Button } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { formatSeconds } from "@/components/deduction/roundAnswer";
import { TimesBoard } from "./TimesBoard";

interface Props {
  gameState: TimePlayerView;
  sendAction: (action: GameAction) => void;
  room: Room;
}

/**
 * Turnos del reloj oculto: el jugador de turno toca EMPEZAR y después PARAR.
 * No se muestra ningún número mientras corre. El tiempo se mide acá con
 * performance.now() (el servidor lo valida contra su propio reloj).
 */
export function TimeTurns({ gameState, sendAction, room }: Props) {
  const { t, locale } = useTranslation();
  const startedAt = useRef<number | null>(null);
  const currentId = gameState.turnOrder[gameState.currentTurnIndex];
  const current = room.players.find((p) => p.id === currentId);
  const myTurn = gameState.isMyTurn;
  const running = gameState.clockRunning;

  // El reloj arranca cuando el servidor confirma el inicio.
  useEffect(() => {
    if (myTurn && running && startedAt.current === null) startedAt.current = performance.now();
    if (!running) startedAt.current = null;
  }, [myTurn, running]);

  function stop() {
    if (startedAt.current === null) return;
    const elapsedMs = Math.round(performance.now() - startedAt.current);
    startedAt.current = null;
    sendAction({ type: "stop-clock", payload: { elapsedMs } });
  }

  return (
    <div className="space-y-6">
      <motion.div
        key={currentId}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center bg-bg-surface border border-border rounded-3xl p-8 space-y-4"
      >
        {myTurn ? (
          <>
            <p className="font-display text-xl text-accent">{t("game.time.your_turn")}</p>
            {gameState.targetMs !== null && (
              <p className="text-text-muted text-sm">
                {t("game.time.target_is")} <span className="text-success font-bold">{formatSeconds(gameState.targetMs, locale)}</span>
              </p>
            )}
            {running ? (
              <Button size="lg" variant="danger" className="w-full py-6 text-2xl" onClick={stop}>
                ⏹ {t("game.time.stop")}
              </Button>
            ) : (
              <Button size="lg" className="w-full py-6 text-2xl" onClick={() => sendAction({ type: "start-clock" })}>
                ▶ {t("game.time.start")}
              </Button>
            )}
            {running && <p className="text-text-muted text-xs">{t("game.time.hidden_clock")}</p>}
          </>
        ) : (
          <>
            <Avatar avatarId={current?.avatarId || "fox"} size="xl" />
            <p className="font-display text-xl font-bold text-primary">{current?.nickname}</p>
            <p className="text-text-secondary text-sm">
              {running ? t("game.time.measuring", { player: current?.nickname ?? "" }) : t("game.time.waiting_start", { player: current?.nickname ?? "" })}
            </p>
            {running && <div className="mx-auto w-3 h-3 rounded-full bg-danger animate-pulse" />}
          </>
        )}
      </motion.div>

      <TimesBoard times={gameState.times} room={room} />
    </div>
  );
}
