import { SCORING } from '@amonglies/shared';

type Points = Record<string, number>;

/**
 * Puntos de una ronda: +2 a cada inocente que votó a un impostor y +2 a cada
 * impostor que seguía en juego y no fue expulsado.
 */
export function roundPoints(input: {
  votes: Record<string, string>;
  impostorIds: string[];
  /** Impostores que seguían en juego al votar. */
  activeImpostorIds: string[];
  votedOutId: string | null;
}): Points {
  const points: Points = {};
  for (const [voterId, targetId] of Object.entries(input.votes)) {
    const voterIsInnocent = !input.impostorIds.includes(voterId);
    if (voterIsInnocent && input.impostorIds.includes(targetId)) {
      add(points, voterId, SCORING.innocentCorrectVote);
    }
  }
  for (const impostorId of input.activeImpostorIds) {
    if (impostorId !== input.votedOutId)
      add(points, impostorId, SCORING.impostorSurvivesRound);
  }
  return points;
}

/** Bonus para todo el equipo que ganó la partida (también los que fueron eliminados). */
export function partidaBonus(input: {
  winner: 'players' | 'impostor';
  impostorIds: string[];
  playerIds: string[];
}): Points {
  const points: Points = {};
  for (const id of input.playerIds) {
    const isImpostor = input.impostorIds.includes(id);
    if (input.winner === 'impostor' && isImpostor)
      add(points, id, SCORING.impostorPartidaWin);
    if (input.winner === 'players' && !isImpostor)
      add(points, id, SCORING.innocentPartidaWin);
  }
  return points;
}

/** Suma `delta` sobre `target` (lo modifica) y lo devuelve. */
export function mergePoints(target: Points, delta: Points): Points {
  for (const [id, value] of Object.entries(delta)) add(target, id, value);
  return target;
}

function add(points: Points, id: string, value: number): void {
  points[id] = (points[id] ?? 0) + value;
}
