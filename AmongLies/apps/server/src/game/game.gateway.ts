import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { GameAction } from '@amonglies/shared';
import { getWordListsByIds } from '@amonglies/shared';
import { GameService } from './game.service.js';
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
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode) return;

    const room = this.roomStore.getRoom(session.roomCode);
    if (!room || room.adminId !== session.playerId) return;

    const updated = this.roomStore.setGameId(session.roomCode, data.gameId);
    if (updated) {
      this.server.to(session.roomCode).emit('room:updated', { room: updated });
    }
  }

  @SubscribeMessage('game:update-settings')
  handleUpdateSettings(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: Record<string, unknown>,
  ) {
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode) return;

    const room = this.roomStore.getRoom(session.roomCode);
    if (!room || room.adminId !== session.playerId) return;

    this.gameService.setGameSettings(session.roomCode, data);

    this.server.to(session.roomCode).emit('room:updated', { room });
  }

  @SubscribeMessage('game:start')
  handleStartGame(@ConnectedSocket() client: Socket) {
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode) return;

    const room = this.roomStore.getRoom(session.roomCode);
    if (!room || room.adminId !== session.playerId) return;
    if (!room.selectedGameId) {
      client.emit('game:error', { message: 'No game selected' });
      return;
    }
    if (room.state !== 'lobby') {
      client.emit('game:error', { message: 'Game already in progress' });
      return;
    }

    const minPlayers = 4;
    if (room.players.length < minPlayers) {
      client.emit('game:error', { message: `Need at least ${minPlayers} players` });
      return;
    }

    const savedSettings = this.gameService.getGameSettings(session.roomCode);
    const selectedLists = (savedSettings['selectedWordLists'] as string[]) || [];
    const wordLists = getWordListsByIds(selectedLists);
    const totalWords = wordLists.flatMap((wl) => wl.words).length;
    if (totalWords === 0) {
      client.emit('game:error', { message: 'no_word_lists_selected' });
      return;
    }

    const roomCode = session.roomCode;

    const engine = this.gameService.startGame(
      roomCode,
      room.selectedGameId,
      room.players,
      (phase) => {
        this.server.to(roomCode).emit('game:phase-change', { phase });
        if (phase === 'game-end') {
          const eng = this.gameService.getEngine(roomCode);
          if (eng) {
            this.server.to(roomCode).emit('game:ended', { results: eng.getResults() });
          }
        }
      },
      () => {
        this.broadcastGameState(roomCode);
      },
    );

    if (!engine) {
      client.emit('game:error', { message: 'Failed to start game' });
      return;
    }

    const updatedRoom = this.roomStore.getRoom(roomCode);
    if (updatedRoom) {
      this.server.to(roomCode).emit('room:updated', { room: updatedRoom });
    }
    this.broadcastGameState(roomCode);
  }

  @SubscribeMessage('game:action')
  handleAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: GameAction,
  ) {
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode) return;

    const error = this.gameService.handleAction(session.roomCode, session.playerId, data);
    if (error) {
      client.emit('game:error', { message: error });
    }
  }

  private broadcastGameState(roomCode: string): void {
    const engine = this.gameService.getEngine(roomCode);
    if (!engine) return;

    const room = this.roomStore.getRoom(roomCode);
    if (!room) return;

    const sockets = this.server.sockets.adapter.rooms.get(roomCode);
    if (!sockets) return;

    for (const socketId of sockets) {
      const session = this.playerService.getSession(socketId);
      if (!session) continue;

      const playerView = engine.getStateForPlayer(session.playerId);
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('game:state-update', playerView);
      }
    }
  }
}
