"use client";

import type { GameAction, ImpostorPlayerView, Room } from "@amonglies/shared";
import { DeductionGame } from "@/components/deduction/DeductionGame";
import { Avatar } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { WordReveal } from "./phases/WordReveal";
import { TurnsChat } from "./phases/TurnsChat";
import { TurnsVoice } from "./phases/TurnsVoice";

interface Props {
  gameState: ImpostorPlayerView;
  sendAction: (action: GameAction) => void;
  room: Room;
  myId: string;
  onBackToLobby: () => void;
}

/** El Impostor clásico: revelación de la palabra y turnos de pistas. */
export function ImpostorGame(props: Props) {
  const { gameState, sendAction, room, myId } = props;

  return (
    <DeductionGame
      {...props}
      renderActivity={(phase) => {
        if (phase === "word-reveal") return <WordReveal gameState={gameState} room={room} />;
        if (phase === "turns") {
          return gameState.settings.communicationMode === "chat" ? (
            <TurnsChat gameState={gameState} sendAction={sendAction} room={room} myId={myId} />
          ) : (
            <TurnsVoice gameState={gameState} sendAction={sendAction} room={room} myId={myId} />
          );
        }
        return null;
      }}
      summary={<CluesList gameState={gameState} room={room} />}
    />
  );
}

/** Pistas dichas en la ronda (se muestran en la discusión). */
function CluesList({ gameState, room }: { gameState: ImpostorPlayerView; room: Room }) {
  const { t } = useTranslation();
  if (gameState.wordsUsed.length === 0) return null;
  return (
    <div>
      <p className="text-text-muted text-xs mb-3 uppercase tracking-wider text-center">
        {t("game.impostor.words_said")}
      </p>
      <div className="space-y-1.5">
        {gameState.wordsUsed.map((entry, i) => {
          const player = room.players.find((p) => p.id === entry.playerId);
          return (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-surface-light">
              <Avatar avatarId={player?.avatarId || "fox"} size="sm" />
              <span className="text-sm text-text-secondary flex-1">{player?.nickname}</span>
              <span className="font-mono text-sm text-primary font-semibold">{entry.word}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
