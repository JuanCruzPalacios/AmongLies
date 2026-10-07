import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { v4 as uuid } from 'uuid';
import type { Player } from '@amonglies/shared';
import { getWordListsByLocale } from '@amonglies/shared';
import { RoomStore } from './room.store.js';
import { parseIdentity, sanitizeRoomSettings } from './room.validation.js';
import { WORD_LISTS_KEY } from '../game/settings.js';
import { PlayerService } from '../player/player.service.js';

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class RoomGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly roomStore: RoomStore,
    private readonly playerService: PlayerService,
  ) {}

  @SubscribeMessage('room:create')
  handleCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown,
  ) {
    const identity = parseIdentity(data);
    if (!identity) {
      client.emit('room:error', {
        message: 'Invalid nickname or avatar',
        code: 'INVALID_IDENTITY',
      });
      return;
    }

    const playerId = uuid();
    const player: Player = {
      id: playerId,
      ...identity,
      isAdmin: true,
      isConnected: true,
    };

    const room = this.roomStore.createRoom(player);
    this.playerService.register(client.id, playerId);
    this.playerService.setRoom(client.id, room.code);
    void client.join(room.code);

    client.emit('room:created', { room, playerId });
  }

  @SubscribeMessage('room:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { code?: unknown },
  ) {
    const identity = parseIdentity(data);
    if (!identity) {
      client.emit('room:error', {
        message: 'Invalid nickname or avatar',
        code: 'INVALID_IDENTITY',
      });
      return;
    }
    const code =
      typeof data.code === 'string' ? data.code.trim().toUpperCase() : '';
    const room = this.roomStore.getRoom(code);
    if (!room) {
      client.emit('room:error', {
        message: 'Room not found',
        code: 'ROOM_NOT_FOUND',
      });
      return;
    }

    if (room.state !== 'lobby') {
      client.emit('room:error', {
        message: 'Game already in progress',
        code: 'GAME_IN_PROGRESS',
      });
      return;
    }

    if (
      room.settings.maxPlayers > 0 &&
      room.players.length >= room.settings.maxPlayers
    ) {
      client.emit('room:error', { message: 'Room is full', code: 'ROOM_FULL' });
      return;
    }

    const playerId = uuid();
    const player: Player = {
      id: playerId,
      ...identity,
      isAdmin: false,
      isConnected: true,
    };

    const updated = this.roomStore.addPlayer(code, player);
    if (!updated) {
      client.emit('room:error', {
        message: 'Could not join room',
        code: 'JOIN_FAILED',
      });
      return;
    }

    this.playerService.register(client.id, playerId);
    this.playerService.setRoom(client.id, code);
    void client.join(code);

    client.emit('room:joined', { room: updated, playerId });
    client.to(code).emit('room:player-joined', { player });
  }

  @SubscribeMessage('room:leave')
  handleLeave(@ConnectedSocket() client: Socket) {
    this.handlePlayerLeave(client);
  }

  @SubscribeMessage('room:kick')
  handleKick(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { playerId: string },
  ) {
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode) return;

    const room = this.roomStore.getRoom(session.roomCode);
    if (!room || room.adminId !== session.playerId) return;

    if (
      typeof data?.playerId !== 'string' ||
      data.playerId === session.playerId
    )
      return;

    const targetSocketId = this.playerService.getSocketIdByPlayerId(
      data.playerId,
    );
    const result = this.roomStore.removePlayer(
      session.roomCode,
      data?.playerId,
    );
    if (!result) return;

    if (targetSocketId) {
      const targetSocket = this.server.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.emit('room:kicked');
        void targetSocket.leave(session.roomCode);
        this.playerService.setRoom(targetSocketId, null);
      }
    }

    this.server.to(session.roomCode).emit('room:player-left', {
      playerId: data?.playerId,
    });
  }

  @SubscribeMessage('room:update-settings')
  handleUpdateSettings(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown,
  ) {
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode) return;

    const room = this.roomStore.getRoom(session.roomCode);
    if (!room || room.adminId !== session.playerId) return;

    const previousLocale = room.settings.locale;
    room.settings = sanitizeRoomSettings(data, room.settings);

    // Las listas de palabras son por idioma: al cambiarlo se eligen todas las del nuevo.
    if (
      room.settings.locale !== previousLocale &&
      WORD_LISTS_KEY in room.gameSettings
    ) {
      room.gameSettings[WORD_LISTS_KEY] = getWordListsByLocale(
        room.settings.locale,
      ).map((list) => list.id);
    }

    this.server.to(session.roomCode).emit('room:updated', { room });
  }

  @SubscribeMessage('room:transfer-admin')
  handleTransferAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { playerId: string },
  ) {
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode) return;

    const room = this.roomStore.getRoom(session.roomCode);
    if (!room || room.adminId !== session.playerId) return;

    const currentAdmin = room.players.find((p) => p.id === session.playerId);
    const newAdmin = room.players.find((p) => p.id === data?.playerId);
    if (!currentAdmin || !newAdmin) return;

    currentAdmin.isAdmin = false;
    newAdmin.isAdmin = true;
    room.adminId = data?.playerId;

    this.server.to(session.roomCode).emit('room:updated', { room });
  }

  handleDisconnect(client: Socket) {
    this.handlePlayerLeave(client);
  }

  private handlePlayerLeave(client: Socket) {
    const session = this.playerService.remove(client.id);
    if (!session?.roomCode) return;

    this.roomStore.updatePlayerConnection(
      session.roomCode,
      session.playerId,
      false,
    );

    const result = this.roomStore.removePlayer(
      session.roomCode,
      session.playerId,
    );
    if (!result) return;

    void client.leave(session.roomCode);
    this.server.to(session.roomCode).emit('room:player-left', {
      playerId: session.playerId,
      newAdminId: result.newAdminId,
    });
  }
}
