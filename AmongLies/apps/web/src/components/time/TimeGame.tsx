"use client";

import type { GameAction, Room, TimePlayerView } from "@amonglies/shared";
import { DeductionGame } from "@/components/deduction/DeductionGame";
import { RoleReveal } from "./RoleReveal";
import { TimeTurns } from "./TimeTurns";
import { TimesBoard } from "./TimesBoard";

interface Props {
  gameState: TimePlayerView;
  sendAction: (action: GameAction) => void;
  room: Room;
  myId: string;
  onBackToLobby: () => void;
}

/** Impostor por tiempo: revelación del rol y turnos con el reloj oculto. */
export function TimeGame(props: Props) {
  const { gameState, sendAction, room } = props;
  return (
    <DeductionGame
      {...props}
      renderActivity={(phase) => {
        if (phase === "role-reveal") return <RoleReveal gameState={gameState} room={room} />;
        if (phase === "turns") return <TimeTurns gameState={gameState} sendAction={sendAction} room={room} />;
        return null;
      }}
      summary={<TimesBoard times={gameState.times} room={room} />}
    />
  );
}
