"use client";

import type { ImpostorPlayerView, Room, GameAction } from "@amonglies/shared";
import { WordReveal } from "./phases/WordReveal";
import { TurnsChat } from "./phases/TurnsChat";
import { TurnsVoice } from "./phases/TurnsVoice";
import { Discussion } from "./phases/Discussion";
import { Voting } from "./phases/Voting";
import { VoteResults } from "./phases/VoteResults";
import { GameEnd } from "./phases/GameEnd";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  gameState: ImpostorPlayerView;
  sendAction: (action: GameAction) => void;
  room: Room;
  myId: string;
  gameEnded: boolean;
  gameResults: unknown;
  onBackToLobby: () => void;
}

export function ImpostorGame({ gameState, sendAction, room, myId, gameEnded, gameResults, onBackToLobby }: Props) {
  const { t } = useTranslation();

  const phaseComponents: Record<string, React.ReactNode> = {
    "word-reveal": (
      <WordReveal gameState={gameState} room={room} />
    ),
    turns: gameState.settings.communicationMode === "chat" ? (
      <TurnsChat gameState={gameState} sendAction={sendAction} room={room} myId={myId} />
    ) : (
      <TurnsVoice gameState={gameState} sendAction={sendAction} room={room} myId={myId} />
    ),
    discussion: (
      <Discussion gameState={gameState} room={room} />
    ),
    voting: (
      <Voting gameState={gameState} sendAction={sendAction} room={room} myId={myId} />
    ),
    "vote-results": (
      <VoteResults gameState={gameState} room={room} />
    ),
    "round-end": (
      <VoteResults gameState={gameState} room={room} />
    ),
    "game-end": (
      <GameEnd gameState={gameState} room={room} results={gameResults} onBackToLobby={onBackToLobby} />
    ),
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
      <div className="text-center mb-4">
        <span className="text-text-muted text-sm font-display">
          {t("game.impostor.round", { n: gameState.round, total: gameState.totalRounds })}
        </span>
      </div>
      <div className="w-full max-w-2xl">
        {phaseComponents[gameState.phase] || (
          <p className="text-text-muted text-center">Loading...</p>
        )}
      </div>
    </div>
  );
}
