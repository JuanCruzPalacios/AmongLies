import type { CommunicationMode } from './common';

export type ImpostorPhase =
  | 'word-reveal'
  | 'turns'
  | 'discussion'
  | 'voting'
  | 'vote-results'
  | 'partida-end'
  | 'game-end';

export interface ImpostorSettings {
  partidas: number;
  /** 0 = sin límite: la partida sigue hasta que gane un bando. */
  maxRoundsPerPartida: number;
  impostorCount: number;
  turnTimeSeconds: number;
  discussionTimeSeconds: number;
  votingTimeSeconds: number;
  wordRevealTimeSeconds: number;
  selectedWordLists: string[];
  communicationMode: CommunicationMode;
  /** Si es true, en los resultados sólo se ven cuántos votos recibió cada uno, no quién votó a quién. */
  secretVote: boolean;
  /** Permite votar "saltear" (nadie). Si "saltear" gana, no se expulsa a nadie. */
  allowSkipVote: boolean;
  tieBreak: TieBreak;
  /** El impostor ve la categoría de la palabra (no la palabra). */
  impostorCategoryHint: boolean;
}

/** Qué pasa si hay empate en la votación. */
export type TieBreak = 'none' | 'revote' | 'random';

/** Voto especial para no expulsar a nadie (si `allowSkipVote`). */
export const SKIP_VOTE = 'skip';

export interface ImpostorGameState {
  phase: ImpostorPhase;
  partida: number;        // outer game number (1-based)
  totalPartidas: number;
  roundWithinPartida: number; // inner round within current partida (1-based)
  secretWord: string;
  /** Categoría de la lista de la que salió la palabra (para la pista del impostor). */
  category: string;
  impostorIds: string[];
  eliminatedPlayerIds: string[];
  turnOrder: string[];
  currentTurnIndex: number;
  wordsUsed: WordEntry[];
  votes: Record<string, string>;
  /** Durante un re-voto por empate: los únicos que se pueden votar. */
  revoteCandidates: string[] | null;
  skipDiscussionVotes: string[];
  partidaEndSkipVotes: string[];
  results: RoundResult[];
  partidaResults: PartidaResult[];
  settings: ImpostorSettings;
  gameWinner: 'players' | 'impostor' | null;
  /** La partida está congelada porque se desconectó un jugador. */
  paused: boolean;
  /** Puntos acumulados y ya revelados (se actualizan al terminar cada partida). */
  scores: Record<string, number>;
  /** Puntos de la partida en curso: se ocultan hasta que termina porque delatarían al impostor. */
  pendingPoints: Record<string, number>;
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

export interface WordEntry {
  playerId: string;
  word: string;
}

export interface RoundResult {
  partida: number;
  ronda: number;
  word: string;
  impostorIds: string[];
  votedOutId: string | null;
  winner: 'impostor' | 'players' | 'tie';
  /** Cuántos votos recibió cada uno (incluye SKIP_VOTE). Siempre visible. */
  voteCounts: Record<string, number>;
  /** Cómo se resolvió un empate, si lo hubo. */
  tieBreak: 'revote' | 'random' | null;
}

export interface ImpostorPlayerView {
  phase: ImpostorPhase;
  partida: number;
  totalPartidas: number;
  roundWithinPartida: number;
  isImpostor: boolean;
  secretWord: string | null;
  /** Categoría de la palabra: la ven los inocentes y el impostor sólo si está la pista activada. */
  category: string | null;
  fellowImpostorIds: string[];
  eliminatedPlayerIds: string[];
  turnOrder: string[];
  currentTurnIndex: number;
  isMyTurn: boolean;
  wordsUsed: WordEntry[];
  /** Quién votó a quién: vacío durante la votación y siempre si el voto es secreto. */
  votes: Record<string, string>;
  hasVoted: boolean;
  voteCount: number;
  revoteCandidates: string[] | null;
  skipDiscussionVotes: string[];
  partidaEndSkipVotes: string[];
  results: RoundResult[];
  partidaResults: PartidaResult[];
  settings: ImpostorSettings;
  gameWinner: 'players' | 'impostor' | null;
  paused: boolean;
  /** Puntos acumulados revelados (al terminar cada partida). */
  scores: Record<string, number>;
}
