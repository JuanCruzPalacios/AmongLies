import type { CommunicationMode } from './common';

export type ImpostorPhase =
  | 'word-reveal'
  | 'turns'
  | 'discussion'
  | 'voting'
  | 'vote-results'
  | 'partida-end'
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
  partida: number;        // outer game number (1-based)
  totalPartidas: number;
  roundWithinPartida: number; // inner round within current partida (1-based)
  secretWord: string;
  impostorIds: string[];
  eliminatedPlayerIds: string[];
  turnOrder: string[];
  currentTurnIndex: number;
  wordsUsed: WordEntry[];
  votes: Record<string, string>;
  skipDiscussionVotes: string[];
  partidaEndSkipVotes: string[];
  results: RoundResult[];
  settings: ImpostorSettings;
  gameWinner: 'players' | 'impostor' | null;
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
  impostorGuessedWord: boolean;
  winner: 'impostor' | 'players' | 'tie';
}

export interface ImpostorPlayerView {
  phase: ImpostorPhase;
  partida: number;
  totalPartidas: number;
  roundWithinPartida: number;
  isImpostor: boolean;
  secretWord: string | null;
  fellowImpostorIds: string[];
  eliminatedPlayerIds: string[];
  turnOrder: string[];
  currentTurnIndex: number;
  isMyTurn: boolean;
  wordsUsed: WordEntry[];
  votes: Record<string, string>;
  hasVoted: boolean;
  voteCount: number;
  skipDiscussionVotes: string[];
  partidaEndSkipVotes: string[];
  results: RoundResult[];
  settings: ImpostorSettings;
  timeRemaining: number;
  gameWinner: 'players' | 'impostor' | null;
}
