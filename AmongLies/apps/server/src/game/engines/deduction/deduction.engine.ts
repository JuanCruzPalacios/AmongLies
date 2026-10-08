import type {
  DeductionCommonPhase,
  DeductionPlayerView,
  DeductionRoundResult,
  DeductionSettings,
  GameAction,
  GameId,
  PartidaEndReason,
  PartidaResult,
  Player,
} from '@amonglies/shared';
import { SKIP_VOTE } from '@amonglies/shared';
import type {
  ActionContext,
  EngineCallbacks,
  GameEngine,
  GameView,
  PlayerGameStats,
} from '../../engine.js';
import { decideVoteOutcome, resolveVotes } from '../core/votes.js';
import { mergePoints, partidaBonus, roundPoints } from '../core/scoring.js';
import { getPartidaEndReason, maxImpostorsFor } from '../core/rules.js';
import { PausableTimers } from '../core/timers.js';

const PARTIDA_END_SECONDS = 15;
const VOTE_RESULTS_SECONDS = 9;

/** Estado común a todos los juegos de la familia Impostor. */
export interface DeductionState<
  TPhase extends string,
  TSettings extends DeductionSettings,
  TResult extends DeductionRoundResult,
> {
  phase: TPhase | DeductionCommonPhase;
  partida: number;
  totalPartidas: number;
  roundWithinPartida: number;
  impostorIds: string[];
  eliminatedPlayerIds: string[];
  turnOrder: string[];
  currentTurnIndex: number;
  votes: Record<string, string>;
  revoteCandidates: string[] | null;
  skipDiscussionVotes: string[];
  partidaEndSkipVotes: string[];
  results: TResult[];
  partidaResults: PartidaResult[];
  settings: TSettings;
  gameWinner: 'players' | 'impostor' | null;
  paused: boolean;
  /** Puntos acumulados y ya revelados (se actualizan al terminar cada partida). */
  scores: Record<string, number>;
  /** Puntos de la partida en curso: se ocultan hasta que termina porque delatarían al impostor. */
  pendingPoints: Record<string, number>;
}

/** Vista común que cada juego completa con lo suyo. */
export type CommonView<
  TGame extends GameId,
  TPhase extends string,
  TSettings extends DeductionSettings,
  TResult extends DeductionRoundResult,
> = DeductionPlayerView<TGame, TPhase, TSettings, TResult>;

/**
 * Esqueleto común: roles, turnos, discusión, votación (saltear, empates),
 * puntaje, fin de partida, pausa, salida de jugadores y estadísticas.
 * Cada juego implementa su actividad de ronda y lo que agrega a la vista.
 */
export abstract class DeductionEngine<
  TGame extends GameId,
  TPhase extends string,
  TSettings extends DeductionSettings,
  TResult extends DeductionRoundResult,
> implements GameEngine {
  protected state: DeductionState<TPhase, TSettings, TResult>;
  protected players: Player[];
  private timers = new PausableTimers();
  private stats = new Map<string, PlayerGameStats>();

  constructor(
    protected readonly gameId: TGame,
    players: Player[],
    settings: TSettings,
    protected readonly callbacks: EngineCallbacks,
  ) {
    this.players = players;
    this.state = {
      phase: 'discussion',
      partida: 1,
      totalPartidas: settings.partidas,
      roundWithinPartida: 1,
      impostorIds: [],
      eliminatedPlayerIds: [],
      turnOrder: [],
      currentTurnIndex: 0,
      votes: {},
      revoteCandidates: null,
      skipDiscussionVotes: [],
      partidaEndSkipVotes: [],
      results: [],
      partidaResults: [],
      settings,
      gameWinner: null,
      paused: false,
      scores: {},
      pendingPoints: {},
    };
  }

  // ─── Lo que aporta cada juego ────────────────────────────────────────────

  /** Prepara la ronda (palabra, tiempo objetivo…) y arranca su primera fase. */
  protected abstract startRoundActivity(): void;
  /** Empieza el turno de `currentTurnPlayerId()` (timers, estado del turno). */
  protected abstract beginTurn(): void;
  /** Acciones propias del juego. `undefined` = no es una acción de este juego. */
  protected abstract handleActivityAction(
    playerId: string,
    action: GameAction,
    ctx: ActionContext,
  ): string | null | undefined;
  /** Datos propios de la ronda que se guardan en su resultado. */
  protected abstract roundExtras(): Omit<TResult, keyof DeductionRoundResult>;
  /** Completa la vista común con lo propio del juego. */
  protected abstract buildView(
    playerId: string,
    common: CommonView<TGame, TPhase, TSettings, TResult>,
  ): GameView;
  /** Se pausó la partida (p. ej. el Tiempo cancela un reloj en marcha). */
  protected onPause(): void {}
  /** Jugaron todos: true si el juego quiere otra vuelta de turnos en la misma ronda. */
  protected startNextLap(): boolean {
    return false;
  }

  // ─── GameEngine ──────────────────────────────────────────────────────────

  start(): void {
    this.startPartida();
  }

  getStateForPlayer(playerId: string): GameView {
    const phase = this.state.phase;
    const isImpostor = this.state.impostorIds.includes(playerId);
    const resultsOver = phase === 'partida-end' || phase === 'game-end';

    return this.buildView(playerId, {
      gameId: this.gameId,
      phase,
      partida: this.state.partida,
      totalPartidas: this.state.totalPartidas,
      roundWithinPartida: this.state.roundWithinPartida,
      isImpostor,
      fellowImpostorIds: isImpostor
        ? this.state.impostorIds.filter((id) => id !== playerId)
        : [],
      eliminatedPlayerIds: [...this.state.eliminatedPlayerIds],
      turnOrder: this.state.turnOrder,
      currentTurnIndex: this.state.currentTurnIndex,
      isMyTurn: phase === 'turns' && this.currentTurnPlayerId() === playerId,
      votes:
        !this.state.settings.secretVote &&
        (phase === 'vote-results' || resultsOver)
          ? this.state.votes
          : {},
      hasVoted: playerId in this.state.votes,
      voteCount: Object.keys(this.state.votes).length,
      revoteCandidates: this.state.revoteCandidates,
      skipDiscussionVotes: [...this.state.skipDiscussionVotes],
      partidaEndSkipVotes: [...this.state.partidaEndSkipVotes],
      results: this.sanitizedResults(),
      partidaResults: this.state.partidaResults,
      settings: this.state.settings,
      gameWinner: this.state.gameWinner,
      paused: this.state.paused,
      scores: this.state.scores,
    });
  }

  handleAction(
    playerId: string,
    action: GameAction,
    ctx: ActionContext,
  ): string | null {
    if (this.state.paused) return 'game_paused';
    switch (action.type) {
      case 'vote':
        this.handleVote(playerId, action.payload);
        return null;
      case 'skip-discussion':
        this.handleSkipDiscussion(playerId);
        return null;
      case 'skip-partida-end':
        this.handleSkipPartidaEnd(playerId);
        return null;
    }
    return this.handleActivityAction(playerId, action, ctx) ?? null;
  }

  canChat(playerId: string): boolean {
    return (
      this.state.phase === 'game-end' ||
      !this.state.eliminatedPlayerIds.includes(playerId)
    );
  }

  hasPlayer(playerId: string): boolean {
    return this.players.some((p) => p.id === playerId);
  }

  /** Congela la partida (timers incluidos) mientras alguien está desconectado. */
  pause(): void {
    if (this.state.paused || this.state.phase === 'game-end') return;
    this.state.paused = true;
    this.timers.pause();
    this.onPause();
    this.callbacks.onStateUpdate();
  }

  resume(): void {
    if (!this.state.paused) return;
    this.state.paused = false;
    this.timers.resume();
    this.callbacks.onStateUpdate();
  }

  /** Estadísticas de cada jugador que sigue en la partida (se guardan al terminar). */
  getPlayerStats(): PlayerGameStats[] {
    return this.players.map((p) => ({
      ...this.statsFor(p.id),
      points: this.state.scores[p.id] ?? 0,
    }));
  }

  destroy(): void {
    this.timers.clearAll();
  }

  /** Saca a un jugador de la partida (se fue, lo echaron o se sigue sin él). */
  removePlayer(playerId: string): void {
    if (!this.hasPlayer(playerId)) return;
    this.players = this.players.filter((p) => p.id !== playerId);

    delete this.state.votes[playerId];
    for (const [voter, target] of Object.entries(this.state.votes)) {
      // Quienes lo habían votado pueden volver a votar.
      if (target === playerId) delete this.state.votes[voter];
    }
    this.state.skipDiscussionVotes = this.state.skipDiscussionVotes.filter(
      (id) => id !== playerId,
    );
    this.state.partidaEndSkipVotes = this.state.partidaEndSkipVotes.filter(
      (id) => id !== playerId,
    );

    const phase = this.state.phase;
    if (phase === 'game-end') {
      this.callbacks.onStateUpdate();
      return;
    }

    // Si con su salida no quedan impostores, o hay paridad, la partida termina ya.
    if (phase !== 'vote-results' && phase !== 'partida-end') {
      const impostors = this.activeImpostors().length;
      const reason = getPartidaEndReason({
        activeImpostors: impostors,
        activeInnocents: this.activePlayers().length - impostors,
        round: this.state.roundWithinPartida,
        maxRounds: 0,
      });
      if (reason) {
        this.endPartidaEarly(reason);
        return;
      }
    }

    const index = this.state.turnOrder.indexOf(playerId);
    if (index !== -1) {
      this.state.turnOrder.splice(index, 1);
      const wasTheirTurn =
        phase === 'turns' && index === this.state.currentTurnIndex;
      if (index < this.state.currentTurnIndex || wasTheirTurn)
        this.state.currentTurnIndex--;
      if (wasTheirTurn) {
        this.clearTimer('turn');
        this.nextTurn();
        return;
      }
    }

    const active = this.activePlayers().length;
    if (phase === 'voting' && Object.keys(this.state.votes).length >= active) {
      this.clearTimer('voting');
      this.finishVoting();
    } else if (
      phase === 'discussion' &&
      this.state.skipDiscussionVotes.length >= active
    ) {
      this.clearTimer('discussion');
      this.startVoting();
    } else if (
      phase === 'partida-end' &&
      this.state.partidaEndSkipVotes.length >= this.players.length
    ) {
      this.clearTimer('partida-end');
      this.advanceToNextPartida();
    } else {
      this.callbacks.onStateUpdate();
    }
  }

  // ─── Helpers para los juegos ─────────────────────────────────────────────

  protected activePlayers(): Player[] {
    return this.players.filter(
      (p) => !this.state.eliminatedPlayerIds.includes(p.id),
    );
  }

  protected activeImpostors(): string[] {
    return this.state.impostorIds.filter(
      (id) =>
        !this.state.eliminatedPlayerIds.includes(id) && this.hasPlayer(id),
    );
  }

  protected isImpostor(playerId: string): boolean {
    return this.state.impostorIds.includes(playerId);
  }

  protected currentTurnPlayerId(): string | undefined {
    return this.state.turnOrder[this.state.currentTurnIndex];
  }

  /** Arranca la fase de turnos desde el primer jugador. */
  protected startTurns(): void {
    this.state.currentTurnIndex = 0;
    this.setPhase('turns' as TPhase);
    this.beginTurn();
  }

  /** Pasa al siguiente turno, o a la discusión si ya jugaron todos. */
  protected nextTurn(): void {
    this.state.currentTurnIndex++;
    if (this.state.currentTurnIndex >= this.state.turnOrder.length) {
      if (!this.startNextLap()) {
        this.startDiscussion();
        return;
      }
      this.state.currentTurnIndex = 0;
    }
    // Primero se prepara el turno nuevo, así el estado emitido ya es el correcto.
    this.beginTurn();
    this.callbacks.onStateUpdate();
  }

  protected setPhase(phase: TPhase | DeductionCommonPhase): void {
    this.state.phase = phase;
    this.callbacks.onPhaseChange(phase);
    this.callbacks.onStateUpdate();
  }

  protected setTimer(name: string, ms: number, callback: () => void): void {
    this.timers.set(name, ms, callback);
  }

  protected clearTimer(name: string): void {
    this.timers.clear(name);
  }

  protected shuffle<T>(items: T[]): T[] {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // ─── Ciclo de partidas y rondas ──────────────────────────────────────────

  private startPartida(): void {
    this.state.eliminatedPlayerIds = [];
    this.state.roundWithinPartida = 1;
    this.state.impostorIds = this.selectImpostors();
    this.state.gameWinner = null;
    this.state.pendingPoints = {};
    this.startRound();
  }

  private startRound(): void {
    this.state.turnOrder = this.shuffle(this.activePlayers().map((p) => p.id));
    this.state.currentTurnIndex = 0;
    this.state.votes = {};
    this.state.revoteCandidates = null;
    this.state.skipDiscussionVotes = [];

    this.callbacks.onRoundStart({
      partida: this.state.partida,
      ronda: this.state.roundWithinPartida,
    });
    this.startRoundActivity();
  }

  private selectImpostors(): string[] {
    const count = Math.min(
      this.state.settings.impostorCount,
      maxImpostorsFor(this.players.length),
    );
    return this.shuffle(this.players.map((p) => p.id)).slice(0, count);
  }

  private startDiscussion(): void {
    this.setPhase('discussion');
    if (this.state.settings.discussionTimeSeconds > 0) {
      this.setTimer(
        'discussion',
        this.state.settings.discussionTimeSeconds * 1000,
        () => this.startVoting(),
      );
    } else {
      this.startVoting();
    }
  }

  private startVoting(): void {
    this.setPhase('voting');
    this.setTimer('voting', this.state.settings.votingTimeSeconds * 1000, () =>
      this.finishVoting(),
    );
  }

  // ─── Acciones comunes ────────────────────────────────────────────────────

  private handleSkipDiscussion(playerId: string): void {
    if (this.state.phase !== 'discussion') return;
    if (this.state.skipDiscussionVotes.includes(playerId)) return;
    if (!this.activePlayers().some((p) => p.id === playerId)) return;

    this.state.skipDiscussionVotes.push(playerId);

    if (this.state.skipDiscussionVotes.length >= this.activePlayers().length) {
      this.clearTimer('discussion');
      this.startVoting();
    } else {
      this.callbacks.onStateUpdate();
    }
  }

  private handleSkipPartidaEnd(playerId: string): void {
    if (this.state.phase !== 'partida-end') return;
    if (this.state.partidaEndSkipVotes.includes(playerId)) return;
    if (!this.hasPlayer(playerId)) return;

    this.state.partidaEndSkipVotes.push(playerId);

    if (this.state.partidaEndSkipVotes.length >= this.players.length) {
      this.clearTimer('partida-end');
      this.advanceToNextPartida();
    } else {
      this.callbacks.onStateUpdate();
    }
  }

  private handleVote(playerId: string, targetId: unknown): void {
    if (this.state.phase !== 'voting') return;
    if (typeof targetId !== 'string' || playerId === targetId) return;
    if (playerId in this.state.votes) return;
    const active = this.activePlayers();
    if (!active.some((p) => p.id === playerId)) return;

    const isSkip = targetId === SKIP_VOTE;
    if (isSkip && !this.state.settings.allowSkipVote) return;
    if (!isSkip) {
      if (!active.some((p) => p.id === targetId)) return;
      const candidates = this.state.revoteCandidates;
      if (candidates && !candidates.includes(targetId)) return;
    }

    this.state.votes[playerId] = targetId;
    this.callbacks.onStateUpdate();

    if (Object.keys(this.state.votes).length >= active.length) {
      this.clearTimer('voting');
      this.finishVoting();
    }
  }

  // ─── Votación, resultados y fin de partida ───────────────────────────────

  private finishVoting(): void {
    const resolution = resolveVotes(this.state.votes);
    const isRevote = this.state.revoteCandidates !== null;
    const outcome = decideVoteOutcome(resolution, {
      tieBreak: this.state.settings.tieBreak,
      alreadyRevoted: isRevote,
    });

    // Empate con re-voto: se vota de nuevo, sólo entre los empatados.
    if (outcome.kind === 'revote') {
      this.state.revoteCandidates = outcome.candidates;
      this.state.votes = {};
      this.startVoting();
      return;
    }

    const votedOutId = outcome.kind === 'expel' ? outcome.playerId : null;
    const tieBreak = isRevote ? 'revote' : outcome.tieBreak;
    this.state.revoteCandidates = null;

    // Los puntos de la ronda quedan ocultos hasta que termina la partida.
    mergePoints(
      this.state.pendingPoints,
      roundPoints({
        votes: this.state.votes,
        impostorIds: this.state.impostorIds,
        activeImpostorIds: this.activeImpostors(),
        votedOutId,
      }),
    );
    this.countVotes();

    if (votedOutId !== null) {
      this.state.eliminatedPlayerIds.push(votedOutId);
    }

    const remainingImpostors = this.activeImpostors().length;
    const endReason = getPartidaEndReason({
      activeImpostors: remainingImpostors,
      activeInnocents: this.activePlayers().length - remainingImpostors,
      round: this.state.roundWithinPartida,
      maxRounds: this.state.settings.maxRoundsPerPartida,
    });

    this.state.results.push({
      partida: this.state.partida,
      ronda: this.state.roundWithinPartida,
      impostorIds: [...this.state.impostorIds],
      votedOutId,
      winner:
        votedOutId === null
          ? 'tie'
          : this.isImpostor(votedOutId)
            ? 'players'
            : 'impostor',
      voteCounts: resolution.counts,
      tieBreak,
      ...this.roundExtras(),
    } as TResult);

    if (endReason) this.recordPartidaEnd(endReason);

    this.setPhase('vote-results');

    this.setTimer('vote-results', VOTE_RESULTS_SECONDS * 1000, () => {
      if (endReason) {
        this.goToPartidaEnd();
      } else {
        this.state.roundWithinPartida++;
        this.startRound();
      }
    });
  }

  private recordPartidaEnd(reason: PartidaEndReason): void {
    const winner = reason === 'impostors-eliminated' ? 'players' : 'impostor';
    const playerIds = this.players.map((p) => p.id);
    const points = mergePoints(
      this.state.pendingPoints,
      partidaBonus({ winner, impostorIds: this.state.impostorIds, playerIds }),
    );
    mergePoints(this.state.scores, points);
    this.state.pendingPoints = {};

    for (const id of playerIds) {
      const isImpostor = this.isImpostor(id);
      const won = (winner === 'impostor') === isImpostor;
      const stats = this.statsFor(id);
      stats.partidasPlayed++;
      if (isImpostor) {
        stats.partidasAsImpostor++;
        if (won) stats.partidasWonAsImpostor++;
      } else {
        stats.partidasAsInnocent++;
        if (won) stats.partidasWonAsInnocent++;
      }
    }

    this.state.gameWinner = winner;
    this.state.partidaResults.push({
      partida: this.state.partida,
      winner,
      reason,
      impostorIds: [...this.state.impostorIds],
      points,
    });
  }

  /** Votos de inocentes (para el % de votos acertados de las estadísticas). */
  private countVotes(): void {
    for (const [voterId, targetId] of Object.entries(this.state.votes)) {
      if (this.isImpostor(voterId)) continue;
      const stats = this.statsFor(voterId);
      stats.innocentVotes++;
      if (this.isImpostor(targetId)) stats.correctVotes++;
    }
  }

  private statsFor(playerId: string): PlayerGameStats {
    let stats = this.stats.get(playerId);
    if (!stats) {
      stats = {
        playerId,
        partidasPlayed: 0,
        partidasAsImpostor: 0,
        partidasWonAsImpostor: 0,
        partidasAsInnocent: 0,
        partidasWonAsInnocent: 0,
        correctVotes: 0,
        innocentVotes: 0,
        points: 0,
      };
      this.stats.set(playerId, stats);
    }
    return stats;
  }

  /** Resumen de la partida, o fin del juego si era la última. */
  private goToPartidaEnd(): void {
    if (this.state.partida >= this.state.totalPartidas) {
      this.setPhase('game-end');
      this.callbacks.onGameEnd();
      return;
    }
    this.state.partidaEndSkipVotes = [];
    this.setPhase('partida-end');
    this.setTimer('partida-end', PARTIDA_END_SECONDS * 1000, () => {
      this.advanceToNextPartida();
    });
  }

  /** La partida termina sin votación (p. ej. se fue el último impostor). */
  private endPartidaEarly(reason: PartidaEndReason): void {
    this.timers.clearAll();
    this.recordPartidaEnd(reason);
    this.goToPartidaEnd();
  }

  private advanceToNextPartida(): void {
    this.state.partida++;
    this.startPartida();
  }

  /** Revela a los impostores sólo cuando corresponde. */
  private sanitizedResults(): TResult[] {
    const phase = this.state.phase;
    return this.state.results.map((r) => {
      const impostorExpelled =
        r.votedOutId !== null && r.impostorIds.includes(r.votedOutId);
      const pastPartida = r.partida < this.state.partida;
      const currentPartidaOver =
        phase === 'game-end' ||
        (phase === 'partida-end' && r.partida === this.state.partida);

      let revealedIds: string[];
      if (currentPartidaOver || pastPartida) {
        // La partida terminó: se revela a todos.
        revealedIds = r.impostorIds;
      } else if (impostorExpelled) {
        // A mitad de partida sólo se revela al impostor expulsado (no a sus cómplices).
        revealedIds = [r.votedOutId!];
      } else {
        revealedIds = [];
      }
      return { ...r, impostorIds: revealedIds };
    });
  }
}
