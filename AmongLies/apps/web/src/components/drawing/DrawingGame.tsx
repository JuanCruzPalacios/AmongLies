"use client";

import type { DrawingPlayerView, GameAction, Room } from "@amonglies/shared";
import { DeductionGame } from "@/components/deduction/DeductionGame";
import { WordReveal } from "@/components/impostor/phases/WordReveal";
import { useTranslation } from "@/hooks/useTranslation";
import { DrawingCanvas } from "./DrawingCanvas";
import { DrawingTurns, WordBanner } from "./DrawingTurns";

interface Props {
  gameState: DrawingPlayerView;
  sendAction: (action: GameAction) => void;
  room: Room;
  myId: string;
  onBackToLobby: () => void;
}

/** Impostor dibujo: una palabra y un lienzo por partida, de a poquito entre todos. */
export function DrawingGame(props: Props) {
  const { gameState, sendAction, room, myId } = props;
  const { t } = useTranslation();
  const word = gameState.results.filter((r) => r.partida === gameState.partida).at(-1)?.word;

  return (
    <DeductionGame
      {...props}
      renderActivity={(phase) => {
        if (phase === "word-reveal")
          return <WordReveal gameState={gameState} room={room} impostorHintKey="game.drawing.impostor_hint" />;
        if (phase === "turns")
          return <DrawingTurns gameState={gameState} sendAction={sendAction} room={room} myId={myId} />;
        return null;
      }}
      summary={
        <div className="space-y-2">
          <WordBanner gameState={gameState} />
          <DrawingCanvas strokes={gameState.strokes} label={t("game.drawing.canvas")} />
        </div>
      }
      showSummaryWhileVoting
      endSummary={
        <div className="space-y-2 max-w-md mx-auto">
          <DrawingCanvas strokes={gameState.strokes} label={t("game.drawing.canvas")} />
          {word && (
            <p className="text-center text-sm text-text-secondary">
              {t("game.impostor.word_was")} <span className="font-bold text-primary">{word}</span>
            </p>
          )}
        </div>
      }
    />
  );
}
