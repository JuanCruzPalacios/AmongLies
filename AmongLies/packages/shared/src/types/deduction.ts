import type { GameId } from './game';

/**
 * Núcleo común de la familia Impostor: los tres juegos comparten roles,
 * discusión, votación, resultados, puntaje y fin de partida. Cada juego
 * aporta sólo su actividad de ronda (pistas, reloj, dibujo).
 */

/** Fases comunes a todos los juegos (las de actividad las define cada uno). */
export type DeductionCommonPhase =
  | 'discussion'
  | 'voting'
  | 'vote-results'
  | 'partida-end'
  | 'game-end';

/** Qué pasa si hay empate en la votación. */
export type TieBreak = 'none' | 'revote' | 'random';

/** Voto especial para no expulsar a nadie (si `allowSkipVote`). */
export const SKIP_VOTE = 'skip';

export interface DeductionSettings {
  partidas: number;
  /** 0 = sin límite: la partida sigue hasta que gane un bando. */
  maxRoundsPerPartida: number;
  impostorCount: number;
  discussionTimeSeconds: number;
  votingTimeSeconds: number;
  /** Si es true, en los resultados sólo se ven cuántos votos recibió cada uno, no quién votó a quién. */
  secretVote: boolean;
  /** Permite votar "saltear" (nadie). Si "saltear" gana, no se expulsa a nadie. */
  allowSkipVote: boolean;
  tieBreak: TieBreak;
}

export interface DeductionRoundResult {
  partida: number;
  ronda: number;
  impostorIds: string[];
  votedOutId: string | null;
  winner: 'impostor' | 'players' | 'tie';
  /** Cuántos votos recibió cada uno (incluye SKIP_VOTE). Siempre visible. */
  voteCounts: Record<string, number>;
  /** Cómo se resolvió un empate, si lo hubo. */
  tieBreak: 'revote' | 'random' | null;
}

export type PartidaEndReason = 'impostors-eliminated' | 'parity' | 'max-rounds';

export interface PartidaResult {
  partida: number;
  winner: 'players' | 'impostor';
  reason: PartidaEndReason;
  impostorIds: string[];
  /** Puntos que sumó cada jugador en esta partida (rondas + bonus de victoria). */
  points: Record<string, number>;
}

/** Lo que ve cada jugador en cualquier juego de la familia (cada juego le suma lo suyo). */
export interface DeductionPlayerView<
  TGame extends GameId,
  TPhase extends string,
  TSettings extends DeductionSettings,
  TResult extends DeductionRoundResult,
> {
  gameId: TGame;
  phase: TPhase | DeductionCommonPhase;
  partida: number;
  totalPartidas: number;
  roundWithinPartida: number;
  isImpostor: boolean;
  fellowImpostorIds: string[];
  eliminatedPlayerIds: string[];
  turnOrder: string[];
  currentTurnIndex: number;
  isMyTurn: boolean;
  /** Quién votó a quién: vacío durante la votación y siempre si el voto es secreto. */
  votes: Record<string, string>;
  hasVoted: boolean;
  voteCount: number;
  /** Durante un re-voto por empate: los únicos que se pueden votar. */
  revoteCandidates: string[] | null;
  skipDiscussionVotes: string[];
  partidaEndSkipVotes: string[];
  results: TResult[];
  partidaResults: PartidaResult[];
  settings: TSettings;
  gameWinner: 'players' | 'impostor' | null;
  /** La partida está congelada porque se desconectó un jugador. */
  paused: boolean;
  /** Puntos acumulados revelados (al terminar cada partida). */
  scores: Record<string, number>;
}
