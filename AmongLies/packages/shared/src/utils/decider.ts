import type { Player } from '../types/player';
import type { Room } from '../types/room';

/**
 * Quién decide en la sala: el admin si está conectado; si no, el jugador
 * conectado más antiguo (el orden de la lista es el orden de llegada).
 */
export function getDecider(room: Room): Player | undefined {
  const admin = room.players.find((p) => p.id === room.adminId);
  if (admin?.isConnected) return admin;
  return room.players.find((p) => p.isConnected);
}
