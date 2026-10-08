import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GATEWAY_OPTIONS } from '../gateway.options.js';
import { v4 as uuid } from 'uuid';
import type { ChatMessage } from '@amonglies/shared';
import { MAX_CHAT_MESSAGE_LENGTH, censor } from '@amonglies/shared';
import { RoomStore } from '../room/room.store.js';
import { PlayerService } from '../player/player.service.js';
import { GameService } from '../game/game.service.js';

@WebSocketGateway(GATEWAY_OPTIONS)
export class ChatGateway {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly roomStore: RoomStore,
    private readonly playerService: PlayerService,
    private readonly gameService: GameService,
  ) {}

  @SubscribeMessage('chat:send')
  handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message?: unknown },
  ) {
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode) return;

    const room = this.roomStore.getRoom(session.roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === session.playerId);
    if (!player) return;

    // Los eliminados no pueden chatear mientras dura la partida.
    const engine = this.gameService.getEngine(session.roomCode);
    if (room.state === 'playing' && engine && !engine.canChat(player.id))
      return;

    if (typeof data?.message !== 'string') return;
    const trimmed = data.message.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
    if (!trimmed) return;

    const message: ChatMessage = {
      id: uuid(),
      playerId: player.id,
      playerNickname: player.nickname,
      playerAvatarId: player.avatarId,
      message: censor(trimmed),
      timestamp: Date.now(),
      type: 'player',
    };

    this.roomStore.addChatMessage(session.roomCode, message);
    this.server.to(session.roomCode).emit('chat:message', message);
  }
}
