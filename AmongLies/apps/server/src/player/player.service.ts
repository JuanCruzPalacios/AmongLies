import { Injectable } from '@nestjs/common';

interface SocketSession {
  playerId: string;
  roomCode: string | null;
}

@Injectable()
export class PlayerService {
  private sessions = new Map<string, SocketSession>();

  register(socketId: string, playerId: string): void {
    this.sessions.set(socketId, { playerId, roomCode: null });
  }

  setRoom(socketId: string, roomCode: string | null): void {
    const session = this.sessions.get(socketId);
    if (session) {
      session.roomCode = roomCode;
    }
  }

  getSession(socketId: string): SocketSession | undefined {
    return this.sessions.get(socketId);
  }

  getSocketIdByPlayerId(playerId: string): string | undefined {
    for (const [socketId, session] of this.sessions) {
      if (session.playerId === playerId) return socketId;
    }
    return undefined;
  }

  remove(socketId: string): SocketSession | undefined {
    const session = this.sessions.get(socketId);
    this.sessions.delete(socketId);
    return session;
  }
}
