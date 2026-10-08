import type { DeductionPlayerView, DeductionRoundResult, DeductionSettings } from './deduction';

/**
 * Impostor por tiempo: cada ronda hay un tiempo objetivo secreto que ven los
 * inocentes. Por turnos, cada uno arranca un reloj oculto y lo para cuando cree
 * que pasó ese tiempo; su tiempo se revela a todos. El impostor no conoce el
 * objetivo: tiene que deducirlo de los tiempos de los demás.
 */
export type TimePhase = 'role-reveal' | 'turns';

export interface TimeSettings extends DeductionSettings {
  targetMinSeconds: number;
  targetMaxSeconds: number;
  /** Tiempo máximo para arrancar el reloj y, ya corriendo, para pararlo. */
  maxTurnSeconds: number;
  roleRevealTimeSeconds: number;
}

export interface TimeEntry {
  playerId: string;
  /** Lo que tardó en parar el reloj (o el máximo, si se le pasó). */
  ms: number;
  /** No arrancó o no paró el reloj a tiempo. */
  timedOut: boolean;
}

export interface TimeRoundResult extends DeductionRoundResult {
  targetMs: number;
  times: TimeEntry[];
}

export interface TimePlayerView
  extends DeductionPlayerView<'time', TimePhase, TimeSettings, TimeRoundResult> {
  /** Tiempo objetivo: sólo los inocentes lo ven durante la ronda. */
  targetMs: number | null;
  /** Tiempos ya revelados en esta ronda, en orden de turno. */
  times: TimeEntry[];
  /** El reloj del jugador de turno está corriendo. */
  clockRunning: boolean;
}
