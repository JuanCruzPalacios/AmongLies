import type { Presence, RoomState } from '@amonglies/shared';

export interface FriendshipRow {
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
}

export type Relation = 'none' | 'friends' | 'outgoing' | 'incoming';

/** Qué relación tiene `me` con `other` según las filas de `me`. */
export function relationWith(
  rows: FriendshipRow[],
  me: string,
  other: string,
): Relation {
  const row = rows.find(
    (r) =>
      (r.requester_id === me && r.addressee_id === other) ||
      (r.requester_id === other && r.addressee_id === me),
  );
  if (!row) return 'none';
  if (row.status === 'accepted') return 'friends';
  return row.requester_id === me ? 'outgoing' : 'incoming';
}

/** Separa las filas de `me` en amigos, solicitudes recibidas y enviadas. */
export function splitRelations(
  rows: FriendshipRow[],
  me: string,
): { friends: string[]; incoming: string[]; outgoing: string[] } {
  const result = {
    friends: [] as string[],
    incoming: [] as string[],
    outgoing: [] as string[],
  };
  for (const row of rows) {
    if (row.requester_id !== me && row.addressee_id !== me) continue;
    const other = row.requester_id === me ? row.addressee_id : row.requester_id;
    if (row.status === 'accepted') result.friends.push(other);
    else if (row.requester_id === me) result.outgoing.push(other);
    else result.incoming.push(other);
  }
  return result;
}

/** Presencia a partir de la conexión y la sala de la cuenta. */
export function presenceOf(account: {
  connected: boolean;
  roomCode: string | null;
  roomState: RoomState | null;
}): Presence {
  if (!account.connected) return { status: 'offline', roomCode: null };
  if (!account.roomCode || !account.roomState)
    return { status: 'online', roomCode: null };
  return account.roomState === 'lobby'
    ? { status: 'lobby', roomCode: account.roomCode }
    : { status: 'playing', roomCode: null };
}

/** Lo que se acepta para buscar usuarios (mismo formato que un username). */
export function sanitizeSearch(query: unknown): string | null {
  if (typeof query !== 'string') return null;
  const trimmed = query.trim().replace(/^@/, '');
  return /^[A-Za-z0-9_]{1,20}$/.test(trimmed) ? trimmed : null;
}
