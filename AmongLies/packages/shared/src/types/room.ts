import type { Locale } from './common';
import type { Player } from './player';
import type { ChatMessage } from './chat';

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
  selectedGameId: string | null;
  chat: ChatMessage[];
  createdAt: number;
}

export interface RoomPublicView {
  code: string;
  playerCount: number;
  maxPlayers: number;
  state: RoomState;
  selectedGameId: string | null;
}
