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
import { getDecider } from '@amonglies/shared';
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
    if (room.players.some((p) => !p.isConnected)) {
      client.emit('game:error', {
        message: 'Someone is disconnected',
        code: 'players_disconnected',
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
    if (!session?.roomCode || !session.playerId) return;
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

  /** Quien decide, admin o conectado más antiguo, sigue la partida sin alguien desconectado. */
  @SubscribeMessage('game:continue-without')
  handleContinueWithout(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { playerId?: unknown },
  ) {
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode) return;
    const room = this.roomStore.getRoom(session.roomCode);
    if (!room || room.state !== 'playing') return;
    if (getDecider(room)?.id !== session.playerId) return;

    const target = room.players.find((p) => p.id === data?.playerId);
    if (!target || target.isConnected) return;
    this.removePlayerFromRoom(room.code, target.id);
  }

  // ─── Conexión de jugadores (lo usa RoomGateway) ─────────────────────────

  /** Si el desconectado está jugando, la partida se congela hasta que vuelva. */
  pauseForDisconnect(roomCode: string, playerId: string): void {
    const engine = this.gameService.getEngine(roomCode);
    const room = this.roomStore.getRoom(roomCode);
    if (!engine || room?.state !== 'playing' || !engine.hasPlayer(playerId))
      return;
    engine.pause();
  }

  /** Al reconectar alguien: reanuda si ya no falta nadie y le reenvía el estado. */
  syncAfterReconnect(roomCode: string): void {
    this.resumeIfNobodyMissing(roomCode);
    this.broadcastGameState(roomCode);
  }

  /**
   * Saca a un jugador de la sala y de la partida en curso (se fue, lo echaron,
   * no volvió a tiempo o se decidió seguir sin él).
   */
  removePlayerFromRoom(roomCode: string, playerId: string): void {
    this.gameService.getEngine(roomCode)?.removePlayer(playerId);
    this.playerService.clearRoom(playerId);

    const result = this.roomStore.removePlayer(roomCode, playerId);
    if (!result) return; // la sala quedó vacía y se borró

    this.server.to(roomCode).emit('room:player-left', {
      playerId,
      newAdminId: result.newAdminId,
    });
    this.resumeIfNobodyMissing(roomCode);
  }

  private resumeIfNobodyMissing(roomCode: string): void {
    const engine = this.gameService.getEngine(roomCode);
    const room = this.roomStore.getRoom(roomCode);
    if (!engine || !room) return;
    const someoneMissing = room.players.some(
      (p) => !p.isConnected && engine.hasPlayer(p.id),
    );
    if (!someoneMissing) engine.resume();
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
      if (!session?.playerId) continue;

      const socket = this.server.sockets.sockets.get(socketId);
      socket?.emit(
        'game:state-update',
        engine.getStateForPlayer(session.playerId),
      );
    }
  }
}
