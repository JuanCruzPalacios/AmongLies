import type {
  GameAction,
  GameSettingsValues,
  Player,
  TimeEntry,
  TimePhase,
  TimeRoundResult,
  TimeSettings,
} from '@amonglies/shared';
import type {
  EngineCallbacks,
  GameRegistration,
  GameView,
} from '../../engine.js';
import { CommonView, DeductionEngine } from '../deduction/deduction.engine.js';
import { maxImpostorsFor } from '../core/rules.js';
import { acceptStopTime, pickTargetMs } from './time.rules.js';

/**
 * Impostor por tiempo. Cada ronda hay un tiempo objetivo que sólo ven los
 * inocentes. En su turno, cada jugador toca EMPEZAR y después PARAR cuando cree
 * que pasó ese tiempo; su tiempo se revela a todos. El servidor nunca revela
 * el objetivo durante la ronda (ni la diferencia con él).
 */
export class TimeEngine extends DeductionEngine<
  'time',
  TimePhase,
  TimeSettings,
  TimeRoundResult
> {
  private targetMs = 0;
  private times: TimeEntry[] = [];
  /** Cuándo arrancó el reloj del jugador de turno (null = todavía no arrancó). */
  private clockStartedAt: number | null = null;

  constructor(
    players: Player[],
    settings: TimeSettings,
    callbacks: EngineCallbacks,
  ) {
    super('time', players, settings, callbacks);
  }

  private get maxTurnMs(): number {
    return this.state.settings.maxTurnSeconds * 1000;
  }

  protected startRoundActivity(): void {
    this.targetMs = pickTargetMs(
      this.state.settings.targetMinSeconds,
      this.state.settings.targetMaxSeconds,
    );
    this.times = [];
    this.clockStartedAt = null;

    this.setPhase('role-reveal');
    this.setTimer(
      'role-reveal',
      this.state.settings.roleRevealTimeSeconds * 1000,
      () => this.startTurns(),
    );
  }

  /** Si no arranca el reloj a tiempo, el turno queda como "se le pasó". */
  protected beginTurn(): void {
    this.clockStartedAt = null;
    this.setTimer('turn', this.maxTurnMs, () => this.recordTimeout());
  }

  protected handleActivityAction(
    playerId: string,
    action: GameAction,
  ): string | null | undefined {
    switch (action.type) {
      case 'start-clock':
        this.handleStart(playerId);
        return null;
      case 'stop-clock':
        this.handleStop(playerId, action.payload);
        return null;
    }
    return undefined;
  }

  /** Un reloj en marcha no se puede pausar con justicia: el turno vuelve a empezar. */
  protected onPause(): void {
    if (this.state.phase === 'turns' && this.clockStartedAt !== null) {
      this.beginTurn();
    }
  }

  protected roundExtras() {
    return { targetMs: this.targetMs, times: [...this.times] };
  }

  protected buildView(
    playerId: string,
    common: CommonView<'time', TimePhase, TimeSettings, TimeRoundResult>,
  ): GameView {
    return {
      ...common,
      targetMs: common.isImpostor ? null : this.targetMs,
      times: this.times,
      clockRunning: this.clockStartedAt !== null,
    };
  }

  // ─── Acciones ────────────────────────────────────────────────────────────

  private isCurrentTurn(playerId: string): boolean {
    return (
      this.state.phase === 'turns' && this.currentTurnPlayerId() === playerId
    );
  }

  private handleStart(playerId: string): void {
    if (!this.isCurrentTurn(playerId) || this.clockStartedAt !== null) return;
    this.clockStartedAt = Date.now();
    // Ya corriendo, si no lo para a tiempo se frena solo en el máximo.
    this.setTimer('turn', this.maxTurnMs, () => this.recordTimeout());
    this.callbacks.onStateUpdate();
  }

  private handleStop(playerId: string, payload: unknown): void {
    if (!this.isCurrentTurn(playerId) || this.clockStartedAt === null) return;
    const reported = (payload as { elapsedMs?: unknown } | undefined)
      ?.elapsedMs;
    const ms = acceptStopTime(reported, Date.now() - this.clockStartedAt);
    this.clearTimer('turn');
    this.times.push({ playerId, ms, timedOut: false });
    this.nextTurn();
  }

  private recordTimeout(): void {
    this.times.push({
      playerId: this.currentTurnPlayerId()!,
      ms: this.maxTurnMs,
      timedOut: true,
    });
    this.nextTurn();
  }
}

export const TIME_REGISTRATION: GameRegistration = {
  validateStart(
    players: Player[],
    settings: GameSettingsValues,
  ): string | null {
    if ((settings.impostorCount as number) > maxImpostorsFor(players.length)) {
      return 'too_many_impostors';
    }
    return null;
  },
  create(players, settings, callbacks) {
    // Los ajustes ya vienen validados por sanitizeGameSettings.
    return new TimeEngine(
      players,
      settings as unknown as TimeSettings,
      callbacks,
    );
  },
};
