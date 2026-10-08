import { Injectable } from '@nestjs/common';

/**
 * Una identidad es "un jugador real": la misma cuenta, o el mismo token de
 * invitado del navegador. Sobrevive a las reconexiones del socket.
 */
interface Identity {
  key: string;
  userId: string | null;
  /** Id público del jugador en su sala actual (lo genera el servidor). */
  playerId: string | null;
  roomCode: string | null;
  socketId: string | null;
}

export interface SocketSession {
  playerId: string | null;
  roomCode: string | null;
  userId: string | null;
}

@Injectable()
export class PlayerService {
  private identities = new Map<string, Identity>();
  private socketToKey = new Map<string, string>();

  /**
   * Asocia el socket a su identidad. Si la identidad ya tenía otro socket
   * conectado (otra pestaña de la misma cuenta), lo devuelve para cerrarlo.
   */
  register(
    socketId: string,
    key: string,
    userId: string | null,
  ): string | null {
    const identity = this.identities.get(key) ?? {
      key,
      userId,
      playerId: null,
      roomCode: null,
      socketId: null,
    };
    const previousSocketId = identity.socketId;
    if (previousSocketId) this.socketToKey.delete(previousSocketId);

    identity.socketId = socketId;
    identity.userId = userId;
    this.identities.set(key, identity);
    this.socketToKey.set(socketId, key);
    return previousSocketId;
  }

  getSession(socketId: string): SocketSession | undefined {
    const identity = this.getIdentity(socketId);
    if (!identity) return undefined;
    return {
      playerId: identity.playerId,
      roomCode: identity.roomCode,
      userId: identity.userId,
    };
  }

  setRoom(socketId: string, playerId: string, roomCode: string): void {
    const identity = this.getIdentity(socketId);
    if (!identity) return;
    identity.playerId = playerId;
    identity.roomCode = roomCode;
  }

  /** El jugador salió de su sala (se fue, lo echaron o se siguió sin él). */
  clearRoom(playerId: string): void {
    const identity = this.findByPlayerId(playerId);
    if (!identity) return;
    identity.playerId = null;
    identity.roomCode = null;
    if (!identity.socketId) this.identities.delete(identity.key);
  }

  /** Cuenta del jugador, o null si es invitado. */
  getUserIdByPlayerId(playerId: string): string | null {
    return this.findByPlayerId(playerId)?.userId ?? null;
  }

  /** Conexión y sala de una cuenta (para la presencia de los amigos). */
  getAccount(
    userId: string,
  ): { socketId: string | null; roomCode: string | null } | undefined {
    const identity = this.identities.get(`user:${userId}`);
    return identity
      ? { socketId: identity.socketId, roomCode: identity.roomCode }
      : undefined;
  }

  getSocketIdByPlayerId(playerId: string): string | null {
    return this.findByPlayerId(playerId)?.socketId ?? null;
  }

  /**
   * Se cerró un socket. Devuelve la sesión sólo si era el socket activo de su
   * identidad (si fue reemplazado por otra pestaña, no hay que hacer nada).
   */
  disconnect(socketId: string): SocketSession | undefined {
    const identity = this.getIdentity(socketId);
    this.socketToKey.delete(socketId);
    if (!identity || identity.socketId !== socketId) return undefined;

    identity.socketId = null;
    if (!identity.roomCode) this.identities.delete(identity.key);
    return {
      playerId: identity.playerId,
      roomCode: identity.roomCode,
      userId: identity.userId,
    };
  }

  /** Sesión guardada de una identidad que estaba en una sala (para reconectar). */
  getRestorable(key: string): { playerId: string; roomCode: string } | null {
    const identity = this.identities.get(key);
    if (!identity?.playerId || !identity.roomCode) return null;
    return { playerId: identity.playerId, roomCode: identity.roomCode };
  }

  private getIdentity(socketId: string): Identity | undefined {
    const key = this.socketToKey.get(socketId);
    return key ? this.identities.get(key) : undefined;
  }

  private findByPlayerId(playerId: string): Identity | undefined {
    for (const identity of this.identities.values()) {
      if (identity.playerId === playerId) return identity;
    }
    return undefined;
  }
}
