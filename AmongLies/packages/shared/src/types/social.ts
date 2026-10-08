/** Qué ven tus amigos de vos. */
export type PresenceStatus = 'offline' | 'online' | 'lobby' | 'playing';

export interface Presence {
  status: PresenceStatus;
  /** Sala en la que está (para el botón "Unirme"), si está en una. */
  roomCode: string | null;
}

export interface FriendProfile {
  userId: string;
  username: string;
  avatarId: string;
}

export interface Friend extends FriendProfile {
  presence: Presence;
}

export interface SocialState {
  friends: Friend[];
  /** Solicitudes que te mandaron (quedan guardadas hasta que las respondés). */
  incoming: FriendProfile[];
  /** Solicitudes que mandaste. */
  outgoing: FriendProfile[];
}

/** Invitación a una sala: sólo en vivo, vence a los pocos minutos. */
export interface RoomInvite {
  id: string;
  from: FriendProfile;
  roomCode: string;
  expiresAt: number;
}

export type SocialError =
  | 'guest'
  | 'user_not_found'
  | 'self'
  | 'already_friends'
  | 'already_requested'
  | 'not_friends'
  | 'not_in_room'
  | 'friend_offline'
  | 'too_soon'
  | 'unavailable';

export type SocialAck = (result: { ok: true } | { ok: false; error: SocialError }) => void;
