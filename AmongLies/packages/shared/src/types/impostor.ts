import type { CommunicationMode } from './common';
import type { DeductionPlayerView, DeductionRoundResult, DeductionSettings } from './deduction';

export type ImpostorPhase = 'word-reveal' | 'turns';

export interface ImpostorSettings extends DeductionSettings {
  turnTimeSeconds: number;
  wordRevealTimeSeconds: number;
  selectedWordLists: string[];
  communicationMode: CommunicationMode;
  /** El impostor ve la categoría de la palabra (no la palabra). */
  impostorCategoryHint: boolean;
}

export interface WordEntry {
  playerId: string;
  word: string;
}

export interface RoundResult extends DeductionRoundResult {
  word: string;
}

export interface ImpostorPlayerView
  extends DeductionPlayerView<'impostor', ImpostorPhase, ImpostorSettings, RoundResult> {
  secretWord: string | null;
  /** Categoría de la palabra: la ven los inocentes y el impostor sólo si está la pista activada. */
  category: string | null;
  wordsUsed: WordEntry[];
}
