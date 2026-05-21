import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { v4 as uuid } from 'uuid';
import type { ChatMessage } from '@amonglies/shared';
import { RoomStore } from '../room/room.store.js';
import { PlayerService } from '../player/player.service.js';

@WebSocketGateway()
export class ChatGateway {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly roomStore: RoomStore,
    private readonly playerService: PlayerService,
  ) {}

  @SubscribeMessage('chat:send')
  handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message: string },
  ) {
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode) return;

    const room = this.roomStore.getRoom(session.roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === session.playerId);
    if (!player) return;

    const trimmed = data.message.trim().slice(0, 200);
    if (!trimmed) return;

    const message: ChatMessage = {
      id: uuid(),
      playerId: player.id,
      playerNickname: player.nickname,
      playerAvatarId: player.avatarId,
      message: trimmed,
      timestamp: Date.now(),
      type: 'player',
    };

    this.roomStore.addChatMessage(session.roomCode, message);
    this.server.to(session.roomCode).emit('chat:message', message);
  }
}
