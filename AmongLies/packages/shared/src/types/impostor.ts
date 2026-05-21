import type { CommunicationMode } from './common';

export type ImpostorPhase =
  | 'word-reveal'
  | 'turns'
  | 'discussion'
  | 'voting'
  | 'vote-results'
  | 'round-end'
  | 'game-end';

export interface ImpostorSettings {
  rounds: number;
  impostorCount: number;
  turnTimeSeconds: number;
  discussionTimeSeconds: number;
  votingTimeSeconds: number;
  wordRevealTimeSeconds: number;
  selectedWordLists: string[];
  communicationMode: CommunicationMode;
}

export interface ImpostorGameState {
  phase: ImpostorPhase;
  round: number;
  totalRounds: number;
  secretWord: string;
  impostorIds: string[];
  turnOrder: string[];
  currentTurnIndex: number;
  wordsUsed: WordEntry[];
  votes: Record<string, string>;
  results: RoundResult[];
  settings: ImpostorSettings;
}

export interface WordEntry {
  playerId: string;
  word: string;
}

export interface RoundResult {
  round: number;
  word: string;
  impostorIds: string[];
  votedOutId: string | null;
  impostorGuessedWord: boolean;
  winner: 'impostor' | 'players';
}

export interface ImpostorPlayerView {
  phase: ImpostorPhase;
  round: number;
  totalRounds: number;
  isImpostor: boolean;
  secretWord: string | null;
  fellowImpostorIds: string[];
  turnOrder: string[];
  currentTurnIndex: number;
  isMyTurn: boolean;
  wordsUsed: WordEntry[];
  votes: Record<string, string>;
  hasVoted: boolean;
  results: RoundResult[];
  settings: ImpostorSettings;
  timeRemaining: number;
}
