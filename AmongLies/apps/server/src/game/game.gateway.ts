import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { v4 as uuid } from 'uuid';
import type { ChatMessage, GameAction, Room } from '@amonglies/shared';
import { getGameDefinition } from '@amonglies/shared';
import { GameService } from './game.service.js';
import { getDefaultGameSettings, sanitizeGameSettings } from './settings.js';
import { RoomStore } from '../room/room.store.js';
import { PlayerService } from '../player/player.service.js';

@WebSocketGateway()
export class GameGateway {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly gameService: GameService,
    private readonly roomStore: RoomStore,
    private readonly playerService: PlayerService,
  ) {}

  @SubscribeMessage('game:select')
  handleSelectGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ) {
    const room = this.getAdminRoom(client);
    if (!room || room.state !== 'lobby') return;

    const definition = getGameDefinition(data?.gameId);
    if (!definition) return;

    room.selectedGameId = definition.id;
    room.gameSettings = getDefaultGameSettings(
      definition,
      room.settings.locale,
    );
    this.server.to(room.code).emit('room:updated', { room });
  }

  @SubscribeMessage('game:update-settings')
  handleUpdateSettings(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown,
  ) {
    const room = this.getAdminRoom(client);
    if (!room || room.state !== 'lobby' || !room.selectedGameId) return;

    const definition = getGameDefinition(room.selectedGameId)!;
    room.gameSettings = sanitizeGameSettings(
      definition,
      data,
      room.gameSettings,
      room.settings.locale,
    );
    this.server.to(room.code).emit('room:updated', { room });
  }

  @SubscribeMessage('game:start')
  handleStartGame(@ConnectedSocket() client: Socket) {
    const room = this.getAdminRoom(client);
    if (!room) return;
    if (room.state !== 'lobby') {
      client.emit('game:error', {
        message: 'Game already in progress',
        code: 'game_in_progress',
      });
      return;
    }
    const definition = room.selectedGameId
      ? getGameDefinition(room.selectedGameId)
      : undefined;
    if (!definition) {
      client.emit('game:error', {
        message: 'No game selected',
        code: 'no_game_selected',
      });
      return;
    }
    if (room.players.length < definition.minPlayers) {
      client.emit('game:error', {
        message: `Need at least ${definition.minPlayers} players`,
        code: 'not_enough_players',
      });
      return;
    }

    const roomCode = room.code;
    const error = this.gameService.startGame(room, {
      onStateUpdate: () => this.broadcastGameState(roomCode),
      onPhaseChange: (phase) =>
        this.server.to(roomCode).emit('game:phase-change', { phase }),
      onRoundStart: ({ partida, ronda }) => {
        this.sendSystemMessage(
          roomCode,
          `── Partida ${partida} · Ronda ${ronda} ──`,
        );
      },
      onGameEnd: () => {
        // La sala vuelve al lobby para que puedan entrar jugadores nuevos por link,
        // mientras los demás siguen viendo la pantalla final.
        const updatedRoom = this.roomStore.setState(roomCode, 'lobby');
        if (updatedRoom)
          this.server.to(roomCode).emit('room:updated', { room: updatedRoom });
      },
    });

    if (error) {
      client.emit('game:error', { message: error, code: error });
      return;
    }

    this.server.to(roomCode).emit('room:updated', { room });
    this.broadcastGameState(roomCode);
  }

  /** Sólo el admin puede cortar la partida y volver al lobby. */
  @SubscribeMessage('game:back-to-lobby')
  handleBackToLobby(@ConnectedSocket() client: Socket) {
    const room = this.getAdminRoom(client);
    if (!room) return;

    this.gameService.endGame(room.code);
    this.server.to(room.code).emit('room:updated', { room });
  }

  @SubscribeMessage('game:action')
  handleAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: GameAction,
  ) {
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode) return;
    if (typeof data?.type !== 'string') return;

    const room = this.roomStore.getRoom(session.roomCode);
    if (!room) return;

    const error = this.gameService.handleAction(
      session.roomCode,
      session.playerId,
      data,
      {
        isAdmin: room.adminId === session.playerId,
      },
    );
    if (error) {
      client.emit('game:error', { message: error, code: error });
    }
  }

  private getAdminRoom(client: Socket): Room | undefined {
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode) return undefined;
    const room = this.roomStore.getRoom(session.roomCode);
    if (!room || room.adminId !== session.playerId) return undefined;
    return room;
  }

  private sendSystemMessage(roomCode: string, text: string): void {
    const message: ChatMessage = {
      id: uuid(),
      type: 'system',
      message: text,
      timestamp: Date.now(),
      playerId: '',
      playerNickname: '',
      playerAvatarId: '',
    };
    this.roomStore.addChatMessage(roomCode, message);
    this.server.to(roomCode).emit('chat:message', message);
  }

  private broadcastGameState(roomCode: string): void {
    const engine = this.gameService.getEngine(roomCode);
    if (!engine) return;

    const sockets = this.server.sockets.adapter.rooms.get(roomCode);
    if (!sockets) return;

    for (const socketId of sockets) {
      const session = this.playerService.getSession(socketId);
      if (!session) continue;

      const socket = this.server.sockets.sockets.get(socketId);
      socket?.emit(
        'game:state-update',
        engine.getStateForPlayer(session.playerId),
      );
    }
  }
}
