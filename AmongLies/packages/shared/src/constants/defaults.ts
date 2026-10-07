import type { RoomSettings } from '../types/room';

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 0,
  isPrivate: true,
  locale: 'es',
};

export const ROOM_CODE_LENGTH = 6;
export const RECONNECT_GRACE_PERIOD_MS = 30_000;
export const MIN_NICKNAME_LENGTH = 2;
export const MAX_NICKNAME_LENGTH = 16;
export const MAX_CHAT_MESSAGE_LENGTH = 200;
