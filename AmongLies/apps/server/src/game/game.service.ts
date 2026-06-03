import { Injectable } from '@nestjs/common';
import type { ImpostorSettings, ImpostorPhase, Player, GameAction } from '@amonglies/shared';
import { getWordListsByLocale } from '@amonglies/shared';
import { ImpostorEngine } from './engines/impostor/impostor.engine.js';
import { RoomStore } from '../room/room.store.js';

interface ActiveGame {
  gameId: string;
  roomCode: string;
  engine: ImpostorEngine;
}

@Injectable()
export class GameService {
  private activeGames = new Map<string, ActiveGame>();
  private gameSettings = new Map<string, Record<string, unknown>>();

  constructor(private readonly roomStore: RoomStore) {}

  setGameSettings(roomCode: string, settings: Record<string, unknown>): void {
    this.gameSettings.set(roomCode, {
      ...(this.gameSettings.get(roomCode) || {}),
      ...settings,
    });
  }

  getGameSettings(roomCode: string): Record<string, unknown> {
    return this.gameSettings.get(roomCode) || {};
  }

  startGame(
    roomCode: string,
    gameId: string,
    players: Player[],
    onPhaseChange: (phase: ImpostorPhase) => void,
    onStateUpdate: () => void,
  ): ImpostorEngine | null {
    if (gameId !== 'impostor') return null;

    const savedSettings = this.gameSettings.get(roomCode) || {};
    const locale = (savedSettings['locale'] as 'es' | 'en' | 'pt') || 'es';
    const savedLists = (savedSettings['selectedWordLists'] as string[]) || [];
    const selectedWordLists = savedLists.length > 0
      ? savedLists
      : getWordListsByLocale(locale).map((wl) => wl.id);

    const settings: ImpostorSettings = {
      rounds: (savedSettings['rounds'] as number) || 1,
      impostorCount: (savedSettings['impostorCount'] as number) || 1,
      turnTimeSeconds: (savedSettings['turnTimeSeconds'] as number) || 30,
      discussionTimeSeconds: (savedSettings['discussionTimeSeconds'] as number) || 120,
      votingTimeSeconds: (savedSettings['votingTimeSeconds'] as number) || 30,
      wordRevealTimeSeconds: (savedSettings['wordRevealTimeSeconds'] as number) || 10,
      selectedWordLists,
      communicationMode: (savedSettings['communicationMode'] as 'chat' | 'voice') || 'chat',
    };

    const engine = new ImpostorEngine(players, settings, onPhaseChange, onStateUpdate);
    this.activeGames.set(roomCode, { gameId, roomCode, engine });
    this.roomStore.setState(roomCode, 'playing');
    engine.start();
    return engine;
  }

  getEngine(roomCode: string): ImpostorEngine | undefined {
    return this.activeGames.get(roomCode)?.engine;
  }

  handleAction(roomCode: string, playerId: string, action: GameAction): string | null {
    const game = this.activeGames.get(roomCode);
    if (!game) return null;
    return game.engine.handleAction(playerId, action);
  }

  endGame(roomCode: string): void {
    const game = this.activeGames.get(roomCode);
    if (!game) return;
    game.engine.destroy();
    this.activeGames.delete(roomCode);
    this.roomStore.setState(roomCode, 'lobby');
  }
}
