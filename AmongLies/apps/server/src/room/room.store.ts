import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type { Room, Player, Locale, ChatMessage, RoomSettings } from '@amonglies/shared';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const ROOM_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const ROOM_MAX_INACTIVE_MS = 60 * 60 * 1000;

@Injectable()
export class RoomStore {
  private rooms = new Map<string, Room>();

  constructor() {
    setInterval(() => this.cleanup(), ROOM_CLEANUP_INTERVAL_MS);
  }

  private generateCode(): string {
    let code: string;
    do {
      code = Array.from({ length: CODE_LENGTH }, () =>
        CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
      ).join('');
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(admin: Player, settings?: Partial<RoomSettings>): Room {
    const code = this.generateCode();
    const room: Room = {
      id: uuid(),
      code,
      adminId: admin.id,
      players: [admin],
      state: 'lobby',
      settings: {
        maxPlayers: settings?.maxPlayers ?? 0,
        isPrivate: settings?.isPrivate ?? false,
        locale: settings?.locale ?? admin.locale,
      },
      selectedGameId: null,
      chat: [],
      createdAt: Date.now(),
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  addPlayer(code: string, player: Player): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;
    if (room.settings.maxPlayers > 0 && room.players.length >= room.settings.maxPlayers) {
      return undefined;
    }
    room.players.push(player);
    return room;
  }

  removePlayer(code: string, playerId: string): { room: Room; newAdminId?: string } | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;

    room.players = room.players.filter((p) => p.id !== playerId);

    if (room.players.length === 0) {
      this.rooms.delete(code);
      return undefined;
    }

    let newAdminId: string | undefined;
    if (room.adminId === playerId) {
      const newAdmin = room.players[0];
      newAdmin.isAdmin = true;
      room.adminId = newAdmin.id;
      newAdminId = newAdmin.id;
    }

    return { room, newAdminId };
  }

  updateSettings(code: string, settings: Partial<RoomSettings>): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;
    room.settings = { ...room.settings, ...settings };
    return room;
  }

  setGameId(code: string, gameId: string | null): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;
    room.selectedGameId = gameId;
    return room;
  }

  setState(code: string, state: Room['state']): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;
    room.state = state;
    return room;
  }

  addChatMessage(code: string, message: ChatMessage): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.chat.push(message);
    if (room.chat.length > 200) {
      room.chat = room.chat.slice(-100);
    }
  }

  updatePlayerConnection(code: string, playerId: string, isConnected: boolean): void {
    const room = this.rooms.get(code);
    if (!room) return;
    const player = room.players.find((p) => p.id === playerId);
    if (player) player.isConnected = isConnected;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const allDisconnected = room.players.every((p) => !p.isConnected);
      if (allDisconnected && now - room.createdAt > ROOM_MAX_INACTIVE_MS) {
        this.rooms.delete(code);
      }
    }
  }
}
