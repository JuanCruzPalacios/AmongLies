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
import type { Locale, Player } from '@amonglies/shared';
import { RoomStore } from './room.store.js';
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
    @MessageBody() data: { nickname: string; avatarId: string; locale: Locale },
  ) {
    const playerId = uuid();
    const player: Player = {
      id: playerId,
      nickname: data.nickname,
      avatarId: data.avatarId,
      locale: data.locale,
      isAdmin: true,
      isConnected: true,
    };

    const room = this.roomStore.createRoom(player);
    this.playerService.register(client.id, playerId);
    this.playerService.setRoom(client.id, room.code);
    client.join(room.code);

    client.emit('room:created', { room, playerId });
  }

  @SubscribeMessage('room:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { code: string; nickname: string; avatarId: string; locale: Locale },
  ) {
    const room = this.roomStore.getRoom(data.code);
    if (!room) {
      client.emit('room:error', { message: 'Room not found', code: 'ROOM_NOT_FOUND' });
      return;
    }

    if (room.state !== 'lobby') {
      client.emit('room:error', { message: 'Game already in progress', code: 'GAME_IN_PROGRESS' });
      return;
    }

    if (room.settings.maxPlayers > 0 && room.players.length >= room.settings.maxPlayers) {
      client.emit('room:error', { message: 'Room is full', code: 'ROOM_FULL' });
      return;
    }

    const playerId = uuid();
    const player: Player = {
      id: playerId,
      nickname: data.nickname,
      avatarId: data.avatarId,
      locale: data.locale,
      isAdmin: false,
      isConnected: true,
    };

    const updated = this.roomStore.addPlayer(data.code, player);
    if (!updated) {
      client.emit('room:error', { message: 'Could not join room', code: 'JOIN_FAILED' });
      return;
    }

    this.playerService.register(client.id, playerId);
    this.playerService.setRoom(client.id, data.code);
    client.join(data.code);

    client.emit('room:joined', { room: updated, playerId });
    client.to(data.code).emit('room:player-joined', { player });
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

    const targetSocketId = this.playerService.getSocketIdByPlayerId(data.playerId);
    const result = this.roomStore.removePlayer(session.roomCode, data.playerId);
    if (!result) return;

    if (targetSocketId) {
      const targetSocket = this.server.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.emit('room:kicked');
        targetSocket.leave(session.roomCode);
        this.playerService.setRoom(targetSocketId, null);
      }
    }

    this.server.to(session.roomCode).emit('room:player-left', {
      playerId: data.playerId,
    });
  }

  @SubscribeMessage('room:update-settings')
  handleUpdateSettings(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: Record<string, unknown>,
  ) {
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode) return;

    const room = this.roomStore.getRoom(session.roomCode);
    if (!room || room.adminId !== session.playerId) return;

    const updated = this.roomStore.updateSettings(session.roomCode, data as any);
    if (updated) {
      this.server.to(session.roomCode).emit('room:updated', { room: updated });
    }
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
    const newAdmin = room.players.find((p) => p.id === data.playerId);
    if (!currentAdmin || !newAdmin) return;

    currentAdmin.isAdmin = false;
    newAdmin.isAdmin = true;
    room.adminId = data.playerId;

    this.server.to(session.roomCode).emit('room:updated', { room });
  }

  handleDisconnect(client: Socket) {
    this.handlePlayerLeave(client);
  }

  private handlePlayerLeave(client: Socket) {
    const session = this.playerService.remove(client.id);
    if (!session?.roomCode) return;

    this.roomStore.updatePlayerConnection(session.roomCode, session.playerId, false);

    const result = this.roomStore.removePlayer(session.roomCode, session.playerId);
    if (!result) return;

    client.leave(session.roomCode);
    this.server.to(session.roomCode).emit('room:player-left', {
      playerId: session.playerId,
      newAdminId: result.newAdminId,
    });
  }
}
