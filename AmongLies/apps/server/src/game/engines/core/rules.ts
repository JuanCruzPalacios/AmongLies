import type { PartidaEndReason } from '@amonglies/shared';

/**
 * Máximo de impostores para que la partida no empiece ya ganada:
 * tiene que haber más inocentes que impostores.
 */
export function maxImpostorsFor(playerCount: number): number {
  return Math.max(0, Math.floor((playerCount - 1) / 2));
}

export interface PartidaStatus {
  activeImpostors: number;
  activeInnocents: number;
  /** Ronda que acaba de terminar (1-based). */
  round: number;
  /** 0 = sin límite. */
  maxRounds: number;
}

/** Devuelve por qué termina la partida, o null si sigue. */
export function getPartidaEndReason(
  status: PartidaStatus,
): PartidaEndReason | null {
  if (status.activeImpostors === 0) return 'impostors-eliminated';
  if (status.activeImpostors >= status.activeInnocents) return 'parity';
  if (status.maxRounds > 0 && status.round >= status.maxRounds)
    return 'max-rounds';
  return null;
}
