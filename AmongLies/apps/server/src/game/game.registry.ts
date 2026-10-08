import type { GameId } from '@amonglies/shared';
import type { GameRegistration } from './engine.js';
import { IMPOSTOR_REGISTRATION } from './engines/impostor/impostor.engine.js';
import { TIME_REGISTRATION } from './engines/time/time.engine.js';

/** Para agregar un juego: definirlo en @amonglies/shared y registrarlo acá. */
const GAME_REGISTRY: Record<GameId, GameRegistration> = {
  impostor: IMPOSTOR_REGISTRATION,
  time: TIME_REGISTRATION,
};

export function getGameRegistration(gameId: GameId): GameRegistration {
  return GAME_REGISTRY[gameId];
}
