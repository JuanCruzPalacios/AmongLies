import { Injectable } from '@nestjs/common';
import type { GameAction, Room } from '@amonglies/shared';
import type { ActionContext, EngineCallbacks, GameEngine } from './engine.js';
import { getGameRegistration } from './game.registry.js';
import { RoomStore } from '../room/room.store.js';

@Injectable()
export class GameService {
  private activeGames = new Map<string, GameEngine>();

  constructor(private readonly roomStore: RoomStore) {}

  /** Arranca el juego elegido en la sala. Devuelve un código de error o null. */
  startGame(room: Room, callbacks: EngineCallbacks): string | null {
    if (!room.selectedGameId) return 'no_game_selected';
    const registration = getGameRegistration(room.selectedGameId);

    const error = registration.validateStart(room.players, room.gameSettings);
    if (error) return error;

    this.endGame(room.code);
    const engine = registration.create(
      [...room.players],
      room.gameSettings,
      callbacks,
    );
    this.activeGames.set(room.code, engine);
    this.roomStore.setState(room.code, 'playing');
    engine.start();
    return null;
  }

  getEngine(roomCode: string): GameEngine | undefined {
    return this.activeGames.get(roomCode);
  }

  handleAction(
    roomCode: string,
    playerId: string,
    action: GameAction,
    ctx: ActionContext,
  ): string | null {
    const engine = this.activeGames.get(roomCode);
    if (!engine) return null;
    return engine.handleAction(playerId, action, ctx);
  }

  endGame(roomCode: string): void {
    const engine = this.activeGames.get(roomCode);
    if (!engine) return;
    engine.destroy();
    this.activeGames.delete(roomCode);
    this.roomStore.setState(roomCode, 'lobby');
  }
}
