import type { Locale } from './common';
import type { Player } from './player';
import type { Room, RoomSettings } from './room';
import type { ChatMessage } from './chat';
import type { GameAction } from './game';
import type { ImpostorPlayerView } from './impostor';
import type { TimePlayerView } from './time';
import type { DrawEvent, DrawingPlayerView } from './drawing';
import type { FriendProfile, Presence, RoomInvite, SocialAck, SocialState } from './social';

/** Lo que recibe cada jugador del juego en curso (según `gameId`). */
export type GameView = ImpostorPlayerView | TimePlayerView | DrawingPlayerView;

// Client -> Server
export interface ClientEvents {
  'room:create': (data: { nickname: string; avatarId: string; locale: Locale }) => void;
  'room:join': (data: { code: string; nickname: string; avatarId: string; locale: Locale }) => void;
  'room:leave': () => void;
  'room:kick': (data: { playerId: string }) => void;
  'room:update-settings': (data: Partial<RoomSettings>) => void;
  'room:transfer-admin': (data: { playerId: string }) => void;

  'chat:send': (data: { message: string }) => void;

  'game:select': (data: { gameId: string }) => void;
  'game:update-settings': (data: Record<string, unknown>) => void;
  'game:start': () => void;
  'game:back-to-lobby': () => void;
  /** Quien decide (admin, o el conectado más antiguo) sigue sin un jugador desconectado. */
  'game:continue-without': (data: { playerId: string }) => void;
  'game:action': (data: GameAction) => void;

  // Social (sólo cuentas)
  'social:search': (data: { query: string }, ack: (results: FriendProfile[]) => void) => void;
  'social:request': (data: { username: string }, ack: SocialAck) => void;
  'social:respond': (data: { userId: string; accept: boolean }, ack: SocialAck) => void;
  'social:remove': (data: { userId: string }, ack: SocialAck) => void;
  'social:invite': (data: { userId: string }, ack: SocialAck) => void;
}

// Server -> Client
export interface ServerEvents {
  /** Se manda al conectar: si la identidad ya estaba en una sala, se la restaura. */
  'session:ready': (data: { restored: boolean; room?: Room; playerId?: string }) => void;
  /** La misma cuenta o pestaña se conectó desde otro lado. */
  'session:replaced': () => void;

  'room:created': (data: { room: Room; playerId: string }) => void;
  'room:joined': (data: { room: Room; playerId: string }) => void;
  'room:player-joined': (data: { player: Player }) => void;
  'room:player-left': (data: { playerId: string; newAdminId?: string }) => void;
  'room:updated': (data: { room: Room }) => void;
  'room:kicked': () => void;
  'room:error': (data: { message: string; code: string }) => void;

  'chat:message': (data: ChatMessage) => void;

  'game:state-update': (data: GameView) => void;
  /** Trazos en vivo del juego de Dibujo. */
  'game:draw': (data: DrawEvent) => void;
  'game:phase-change': (data: { phase: string }) => void;
  'game:error': (data: { message: string; code?: string }) => void;

  /** Amigos y solicitudes: se manda al conectar y cada vez que cambian. */
  'social:state': (data: SocialState) => void;
  'social:presence': (data: { userId: string; presence: Presence }) => void;
  'social:request-received': (data: FriendProfile) => void;
  'social:invited': (data: RoomInvite) => void;

  'player:reconnected': (data: { playerId: string }) => void;
  'player:disconnected': (data: { playerId: string }) => void;
}
