import type { GuestIdentity, RoomSettings } from '@amonglies/shared';
import {
  AVATARS,
  MAX_NICKNAME_LENGTH,
  MIN_NICKNAME_LENGTH,
  isLocale,
} from '@amonglies/shared';

const MAX_ROOM_PLAYERS = 100;

/** Valida apodo, avatar e idioma que manda el cliente. Devuelve null si no son válidos. */
export function parseIdentity(data: unknown): GuestIdentity | null {
  if (typeof data !== 'object' || data === null) return null;
  const { nickname, avatarId, locale } = data as Record<string, unknown>;

  if (typeof nickname !== 'string') return null;
  const trimmed = nickname.trim();
  if (
    trimmed.length < MIN_NICKNAME_LENGTH ||
    trimmed.length > MAX_NICKNAME_LENGTH
  )
    return null;
  if (!AVATARS.some((avatar) => avatar.id === avatarId)) return null;

  return {
    nickname: trimmed,
    avatarId: avatarId as string,
    locale: isLocale(locale) ? locale : 'es',
  };
}

/** Aplica sobre `current` sólo los ajustes de sala válidos. */
export function sanitizeRoomSettings(
  input: unknown,
  current: RoomSettings,
): RoomSettings {
  if (typeof input !== 'object' || input === null) return current;
  const { maxPlayers, isPrivate, locale } = input as Record<string, unknown>;
  const next = { ...current };

  if (typeof maxPlayers === 'number' && Number.isInteger(maxPlayers)) {
    next.maxPlayers = Math.min(MAX_ROOM_PLAYERS, Math.max(0, maxPlayers));
  }
  if (typeof isPrivate === 'boolean') next.isPrivate = isPrivate;
  if (isLocale(locale)) next.locale = locale;

  return next;
}
