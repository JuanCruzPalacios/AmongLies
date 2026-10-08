"use client";

import { useEffect, useRef, useState } from "react";
import {
  DRAWING_COLORS,
  DRAWING_SIZES,
  MAX_POINTS_PER_MESSAGE,
  clipToInk,
  parsePoints,
  type DrawingPlayerView,
  type GameAction,
  type InkPoint,
  type Room,
  type Stroke,
} from "@amonglies/shared";
import { Button } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { DrawingCanvas } from "./DrawingCanvas";
import { useLiveStrokes } from "./useLiveStrokes";

/** Cada cuánto se mandan al servidor los puntos acumulados. */
const FLUSH_MS = 50;

interface Props {
  gameState: DrawingPlayerView;
  sendAction: (action: GameAction) => void;
  room: Room;
  myId: string;
}

/** Turnos de dibujo: el de turno dibuja con tinta limitada; los demás miran en vivo. */
export function DrawingTurns({ gameState, sendAction, room, myId }: Props) {
  const { t } = useTranslation();
  const isMyTurn = gameState.isMyTurn;
  const serverStrokes = useLiveStrokes(gameState.strokes, isMyTurn);
  const drawerId = gameState.turnOrder[gameState.currentTurnIndex];
  const drawer = room.players.find((p) => p.id === drawerId);

  const myColor = gameState.playerColors?.[myId];
  const [color, setColor] = useState<string>(myColor ?? DRAWING_COLORS[0]);
  const [size, setSize] = useState<number>(DRAWING_SIZES[1]);

  // Estado local del turno propio: se reinicia en cada turno nuevo.
  const turnKey = `${gameState.partida}-${gameState.roundWithinPartida}-${gameState.lap}-${gameState.currentTurnIndex}`;
  const [turn, setTurn] = useState({ key: turnKey, before: gameState.strokes.length, mine: [] as Stroke[], ink: 0 });
  if (turn.key !== turnKey) setTurn({ key: turnKey, before: gameState.strokes.length, mine: [], ink: 0 });

  const pending = useRef<number[]>([]);
  const last = useRef<InkPoint | null>(null);
  const inkRef = useRef(0);
  useEffect(() => {
    pending.current = [];
    last.current = null;
    inkRef.current = 0;
  }, [turnKey]);

  const budget = gameState.inkBudget;
  const minInk = (budget * gameState.settings.minInkPercent) / 100;
  const inkLeft = Math.max(0, budget - turn.ink);

  function flush() {
    while (pending.current.length > 0) {
      const points = pending.current.splice(0, MAX_POINTS_PER_MESSAGE * 2);
      sendAction({ type: "stroke-points", payload: { points } });
    }
  }

  useEffect(() => {
    if (!isMyTurn) return;
    const id = setInterval(flush, FLUSH_MS);
    return () => {
      clearInterval(id);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, turnKey]);

  function start(x: number, y: number) {
    if (budget - inkRef.current <= 0) return;
    const [px, py] = parsePoints([x, y], 1)!;
    flush();
    last.current = [px, py];
    const strokeColor = myColor ?? color;
    sendAction({ type: "stroke-start", payload: { x: px, y: py, color: strokeColor, size } });
    setTurn((prev) => ({ ...prev, mine: [...prev.mine, { playerId: myId, color: strokeColor, size, points: [px, py] }] }));
  }

  function move(x: number, y: number) {
    if (!last.current) return;
    const rounded = parsePoints([x, y], 1)!;
    const clipped = clipToInk(last.current, rounded, budget - inkRef.current);
    if (clipped.points.length === 0) return;
    const n = clipped.points.length;
    last.current = [clipped.points[n - 2], clipped.points[n - 1]];
    inkRef.current += clipped.used;
    pending.current.push(...clipped.points);
    setTurn((prev) => {
      const strokes = [...prev.mine];
      const current = strokes[strokes.length - 1];
      strokes[strokes.length - 1] = { ...current, points: [...current.points, ...clipped.points] };
      return { ...prev, mine: strokes, ink: inkRef.current };
    });
    // Sin tinta, el servidor pasa el turno solo.
    if (budget - inkRef.current <= 1e-9) {
      last.current = null;
      flush();
    }
  }

  function end() {
    last.current = null;
    flush();
  }

  function finishTurn() {
    flush();
    sendAction({ type: "end-turn" });
  }

  const strokes = isMyTurn ? [...gameState.strokes.slice(0, turn.before), ...turn.mine] : serverStrokes;
  const canFinish = turn.ink >= minInk - 1e-9;
  const laps = gameState.settings.turnsPerRound;

  return (
    <div className="space-y-3">
      <WordBanner gameState={gameState} />

      <div className="flex items-center justify-between text-sm">
        <span className={isMyTurn ? "font-display font-bold text-primary text-lg" : "text-text-secondary"}>
          {isMyTurn ? t("game.drawing.your_turn") : t("game.drawing.drawing_now", { player: drawer?.nickname ?? "" })}
        </span>
        {laps > 1 && (
          <span className="text-text-muted text-xs">{t("game.drawing.lap", { lap: gameState.lap, total: laps })}</span>
        )}
      </div>

      <DrawingCanvas
        strokes={strokes}
        label={t("game.drawing.canvas")}
        {...(isMyTurn && inkLeft > 0 ? { onPointerStart: start, onPointerMove: move, onPointerEnd: end } : {})}
      />

      {isMyTurn && (
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>{t("game.drawing.ink")}</span>
              <span>{Math.round((inkLeft / budget) * 100)}%</span>
            </div>
            <div
              className="h-2.5 rounded-full bg-bg-surface-light overflow-hidden relative"
              role="progressbar"
              aria-label={t("game.drawing.ink")}
              aria-valuenow={Math.round((inkLeft / budget) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${(inkLeft / budget) * 100}%` }} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!myColor &&
              DRAWING_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={t("game.drawing.color", { color: c })}
                  aria-pressed={color === c}
                  className={`w-8 h-8 rounded-full border-2 cursor-pointer transition-transform ${color === c ? "border-white scale-110" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
            {myColor && (
              <span className="flex items-center gap-2 text-xs text-text-muted">
                <span className="w-6 h-6 rounded-full inline-block" style={{ background: myColor }} />
                {t("game.drawing.your_color")}
              </span>
            )}
            <span className="w-px h-6 bg-border mx-1" />
            {DRAWING_SIZES.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                aria-label={t(`game.drawing.size_${i}`)}
                aria-pressed={size === s}
                className={`w-9 h-9 rounded-lg border flex items-center justify-center cursor-pointer ${size === s ? "border-primary bg-primary/10" : "border-border"}`}
              >
                <span className="rounded-full bg-text-primary" style={{ width: 4 + i * 5, height: 4 + i * 5 }} />
              </button>
            ))}
          </div>

          <Button onClick={finishTurn} disabled={!canFinish} className="w-full">
            {t("game.drawing.done")}
          </Button>
          {!canFinish && <p className="text-text-muted text-xs text-center">{t("game.drawing.min_ink")}</p>}
        </div>
      )}
    </div>
  );
}

/** Recordatorio de la palabra (o del rol) arriba del lienzo. */
export function WordBanner({ gameState }: { gameState: DrawingPlayerView }) {
  const { t } = useTranslation();
  if (gameState.isImpostor) {
    return (
      <div className="rounded-xl px-4 py-2 bg-accent/10 border border-accent/40 text-sm text-center">
        <span className="text-accent font-semibold">{t("game.impostor.you_are_impostor")}</span>
        {gameState.category && (
          <span className="text-text-secondary"> · {t("game.impostor.category_hint")} {gameState.category}</span>
        )}
      </div>
    );
  }
  return (
    <div className="rounded-xl px-4 py-2 bg-success/10 border border-success/40 text-sm text-center">
      <span className="text-text-secondary">{t("game.drawing.draw_word")} </span>
      <span className="font-display font-bold text-success">{gameState.secretWord}</span>
    </div>
  );
}
