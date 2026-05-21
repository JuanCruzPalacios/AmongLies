import type { ImpostorSettings } from '../types/impostor';
import type { RoomSettings } from '../types/room';

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 0,
  isPrivate: false,
  locale: 'es',
};

export const DEFAULT_IMPOSTOR_SETTINGS: Omit<ImpostorSettings, 'selectedWordLists' | 'communicationMode'> = {
  rounds: 3,
  impostorCount: 1,
  turnTimeSeconds: 30,
  discussionTimeSeconds: 120,
  votingTimeSeconds: 30,
  wordRevealTimeSeconds: 10,
};

export const ROOM_CODE_LENGTH = 6;
export const RECONNECT_GRACE_PERIOD_MS = 30_000;
export const MIN_NICKNAME_LENGTH = 2;
export const MAX_NICKNAME_LENGTH = 16;
export const MAX_CHAT_MESSAGE_LENGTH = 200;
