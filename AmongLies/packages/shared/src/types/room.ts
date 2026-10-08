import type { Locale } from './common';
import type { Player } from './player';
import type { ChatMessage } from './chat';
import type { GameId, GameSettingsValues } from './game';

export type RoomState = 'lobby' | 'playing' | 'finished';

export interface RoomSettings {
  maxPlayers: number;
  isPrivate: boolean;
  locale: Locale;
}

export interface Room {
  id: string;
  code: string;
  adminId: string;
  players: Player[];
  state: RoomState;
  settings: RoomSettings;
  selectedGameId: GameId | null;
  /** Ajustes del juego elegido, validados por el servidor. */
  gameSettings: GameSettingsValues;
  chat: ChatMessage[];
  createdAt: number;
  /** Listas del workshop que el admin sumó a la sala (sin las palabras). */
  customWordLists: CustomWordListSummary[];
}

export interface CustomWordListSummary {
  id: string;
  title: string;
  locale: Locale;
  drawable: boolean;
  wordCount: number;
}

export interface RoomPublicView {
  code: string;
  playerCount: number;
  maxPlayers: number;
  state: RoomState;
  selectedGameId: GameId | null;
}
