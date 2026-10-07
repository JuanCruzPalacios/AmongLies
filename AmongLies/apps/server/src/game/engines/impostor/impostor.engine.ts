import type {
  GameAction,
  GameSettingsValues,
  ImpostorGameState,
  ImpostorSettings,
  ImpostorPhase,
  ImpostorPlayerView,
  RoundResult,
  Player,
} from '@amonglies/shared';
import { MAX_CHAT_MESSAGE_LENGTH, getWordListsByIds } from '@amonglies/shared';
import type {
  ActionContext,
  EngineCallbacks,
  GameEngine,
  GameRegistration,
} from '../../engine.js';
import { resolveVotes } from '../core/votes.js';
import { getPartidaEndReason, maxImpostorsFor } from '../core/rules.js';
import { PausableTimers } from '../core/timers.js';
import type { PartidaEndReason } from '@amonglies/shared';

const PARTIDA_END_SECONDS = 15;
const VOTE_RESULTS_SECONDS = 9;

export class ImpostorEngine implements GameEngine {
  private state: ImpostorGameState;
  private players: Player[];
  private timers = new PausableTimers();
  private callbacks: EngineCallbacks;

  constructor(
    players: Player[],
    settings: ImpostorSettings,
    callbacks: EngineCallbacks,
  ) {
    this.players = players;
    this.callbacks = callbacks;
    this.state = {
      phase: 'word-reveal',
      partida: 1,
      totalPartidas: settings.partidas,
      roundWithinPartida: 1,
      secretWord: '',
      impostorIds: [],
      eliminatedPlayerIds: [],
      turnOrder: [],
      currentTurnIndex: 0,
      wordsUsed: [],
      votes: {},
      skipDiscussionVotes: [],
      partidaEndSkipVotes: [],
      results: [],
      partidaResults: [],
      settings,
      gameWinner: null,
      paused: false,
    };
  }

  start(): void {
    this.startPartida();
  }

  getStateForPlayer(playerId: string): ImpostorPlayerView {
    const isImpostor = this.state.impostorIds.includes(playerId);
    const phase = this.state.phase;

    // Reveal impostor IDs selectively per result
    const sanitizedResults = this.state.results.map((r): RoundResult => {
      const impostorExpelled =
        r.votedOutId !== null && r.impostorIds.includes(r.votedOutId);
      const pastPartida = r.partida < this.state.partida;
      const currentPartidaOver =
        phase === 'game-end' ||
        (phase === 'partida-end' && r.partida === this.state.partida);

      let revealedIds: string[];
      if (currentPartidaOver || pastPartida) {
        // Partida finished — reveal everyone
        revealedIds = r.impostorIds;
      } else if (impostorExpelled) {
        // Mid-partida, only the expelled impostor is revealed (not co-impostors)
        revealedIds = [r.votedOutId!];
      } else {
        revealedIds = [];
      }

      return { ...r, impostorIds: revealedIds };
    });

    return {
      phase,
      partida: this.state.partida,
      totalPartidas: this.state.totalPartidas,
      roundWithinPartida: this.state.roundWithinPartida,
      isImpostor,
      secretWord: isImpostor ? null : this.state.secretWord,
      fellowImpostorIds: isImpostor
        ? this.state.impostorIds.filter((id) => id !== playerId)
        : [],
      eliminatedPlayerIds: [...this.state.eliminatedPlayerIds],
      turnOrder: this.state.turnOrder,
      currentTurnIndex: this.state.currentTurnIndex,
      isMyTurn:
        phase === 'turns' &&
        this.state.turnOrder[this.state.currentTurnIndex] === playerId,
      wordsUsed: this.state.wordsUsed,
      votes:
        phase === 'vote-results' ||
        phase === 'partida-end' ||
        phase === 'game-end'
          ? this.state.votes
          : {},
      hasVoted: playerId in this.state.votes,
      voteCount: Object.keys(this.state.votes).length,
      skipDiscussionVotes: [...this.state.skipDiscussionVotes],
      partidaEndSkipVotes: [...this.state.partidaEndSkipVotes],
      results: sanitizedResults,
      partidaResults: this.state.partidaResults,
      settings: this.state.settings,
      gameWinner: this.state.gameWinner,
      paused: this.state.paused,
    };
  }

  handleAction(
    playerId: string,
    action: GameAction,
    ctx: ActionContext,
  ): string | null {
    if (this.state.paused) return 'game_paused';
    switch (action.type) {
      case 'submit-word':
        return this.handleSubmitWord(playerId, action.payload);
      case 'ready':
        this.handleReady(playerId);
        break;
      case 'vote':
        this.handleVote(playerId, action.payload);
        break;
      case 'advance':
        if (!ctx.isAdmin) return 'not_admin';
        this.handleAdvance();
        break;
      case 'skip-discussion':
        this.handleSkipDiscussion(playerId);
        break;
      case 'skip-partida-end':
        this.handleSkipPartidaEnd(playerId);
        break;
    }
    return null;
  }

  canChat(playerId: string): boolean {
    return (
      this.state.phase === 'game-end' ||
      !this.state.eliminatedPlayerIds.includes(playerId)
    );
  }

  destroy(): void {
    this.timers.clearAll();
  }

  hasPlayer(playerId: string): boolean {
    return this.players.some((p) => p.id === playerId);
  }

  /** Congela la partida (timers incluidos) mientras alguien está desconectado. */
  pause(): void {
    if (this.state.paused || this.state.phase === 'game-end') return;
    this.state.paused = true;
    this.timers.pause();
    this.callbacks.onStateUpdate();
  }

  resume(): void {
    if (!this.state.paused) return;
    this.state.paused = false;
    this.timers.resume();
    this.callbacks.onStateUpdate();
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
      const wasSpeaking =
        phase === 'turns' && index === this.state.currentTurnIndex;
      if (index < this.state.currentTurnIndex || wasSpeaking)
        this.state.currentTurnIndex--;
      if (wasSpeaking) {
        this.clearTimer('turn');
        this.advanceTurn();
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

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private activePlayers(): Player[] {
    return this.players.filter(
      (p) => !this.state.eliminatedPlayerIds.includes(p.id),
    );
  }

  private activeImpostors(): string[] {
    return this.state.impostorIds.filter(
      (id) =>
        !this.state.eliminatedPlayerIds.includes(id) && this.hasPlayer(id),
    );
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  private startPartida(): void {
    this.state.eliminatedPlayerIds = [];
    this.state.roundWithinPartida = 1;
    this.state.impostorIds = this.selectImpostors();
    this.state.gameWinner = null;
    this.startRound();
  }

  private startRound(): void {
    const wordLists = getWordListsByIds(this.state.settings.selectedWordLists);
    const allWords = wordLists.flatMap((wl) => wl.words);

    this.state.secretWord =
      allWords[Math.floor(Math.random() * allWords.length)];
    this.state.turnOrder = this.shuffleArray(
      this.activePlayers().map((p) => p.id),
    );
    this.state.currentTurnIndex = 0;
    this.state.wordsUsed = [];
    this.state.votes = {};
    this.state.skipDiscussionVotes = [];

    this.callbacks.onRoundStart({
      partida: this.state.partida,
      ronda: this.state.roundWithinPartida,
    });
    this.setPhase('word-reveal');
    this.setTimer(
      'word-reveal',
      this.state.settings.wordRevealTimeSeconds * 1000,
      () => {
        this.setPhase('turns');
        if (this.state.settings.communicationMode === 'chat')
          this.startTurnTimer();
      },
    );
  }

  private selectImpostors(): string[] {
    const count = Math.min(
      this.state.settings.impostorCount,
      maxImpostorsFor(this.players.length),
    );
    return this.shuffleArray(this.players.map((p) => p.id)).slice(0, count);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  private handleSubmitWord(playerId: string, word: unknown): string | null {
    if (this.state.phase !== 'turns') return null;
    if (this.state.turnOrder[this.state.currentTurnIndex] !== playerId)
      return null;
    if (this.state.settings.communicationMode !== 'chat') return null;
    if (typeof word !== 'string') return null;

    const trimmed = word.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
    if (!trimmed) return null;

    if (
      this.state.wordsUsed.some(
        (w) => w.word.toLowerCase() === trimmed.toLowerCase(),
      )
    )
      return 'word_already_used';

    const isImpostor = this.state.impostorIds.includes(playerId);
    if (
      !isImpostor &&
      trimmed.toLowerCase() === this.state.secretWord.toLowerCase()
    ) {
      return 'word_is_secret';
    }

    this.state.wordsUsed.push({ playerId, word: trimmed });
    this.clearTimer('turn');
    this.advanceTurn();
    return null;
  }

  private handleReady(playerId: string): void {
    if (this.state.phase !== 'turns') return;
    if (this.state.settings.communicationMode !== 'voice') return;
    if (this.state.turnOrder[this.state.currentTurnIndex] !== playerId) return;
    this.state.wordsUsed.push({ playerId, word: '(verbal)' });
    this.advanceTurn();
  }

  /** El admin saltea al jugador que está hablando (modo voz). */
  private handleAdvance(): void {
    if (this.state.phase !== 'turns') return;
    if (this.state.settings.communicationMode !== 'voice') return;
    const current = this.state.turnOrder[this.state.currentTurnIndex];
    if (!this.state.wordsUsed.some((w) => w.playerId === current)) {
      this.state.wordsUsed.push({ playerId: current, word: '(skipped)' });
    }
    this.advanceTurn();
  }

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
    if (!this.players.some((p) => p.id === playerId)) return;

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
    if (!active.some((p) => p.id === targetId)) return;

    this.state.votes[playerId] = targetId;
    this.callbacks.onStateUpdate();

    if (Object.keys(this.state.votes).length >= active.length) {
      this.clearTimer('voting');
      this.finishVoting();
    }
  }

  // ─── Turn flow ───────────────────────────────────────────────────────────

  private advanceTurn(): void {
    this.state.currentTurnIndex++;
    if (this.state.currentTurnIndex >= this.state.turnOrder.length) {
      this.setPhase('discussion');
      if (this.state.settings.discussionTimeSeconds > 0) {
        this.setTimer(
          'discussion',
          this.state.settings.discussionTimeSeconds * 1000,
          () => {
            this.startVoting();
          },
        );
      } else {
        this.startVoting();
      }
      return;
    }
    this.callbacks.onStateUpdate();
    if (this.state.settings.communicationMode === 'chat') this.startTurnTimer();
  }

  private finishVoting(): void {
    const { votedOutId } = resolveVotes(this.state.votes);

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
      word: this.state.secretWord,
      impostorIds: [...this.state.impostorIds],
      votedOutId,
      winner:
        votedOutId === null
          ? 'tie'
          : this.state.impostorIds.includes(votedOutId)
            ? 'players'
            : 'impostor',
    });

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
    this.state.gameWinner = winner;
    this.state.partidaResults.push({
      partida: this.state.partida,
      winner,
      reason,
      impostorIds: [...this.state.impostorIds],
    });
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
    for (const name of ['word-reveal', 'turn', 'discussion', 'voting'])
      this.clearTimer(name);
    this.recordPartidaEnd(reason);
    this.goToPartidaEnd();
  }

  private advanceToNextPartida(): void {
    this.state.partida++;
    this.startPartida();
  }

  // ─── Timers ──────────────────────────────────────────────────────────────

  private startTurnTimer(): void {
    this.setTimer('turn', this.state.settings.turnTimeSeconds * 1000, () => {
      const current = this.state.turnOrder[this.state.currentTurnIndex];
      this.state.wordsUsed.push({ playerId: current, word: '(timeout)' });
      this.advanceTurn();
    });
  }

  private startVoting(): void {
    this.setPhase('voting');
    this.setTimer(
      'voting',
      this.state.settings.votingTimeSeconds * 1000,
      () => {
        this.finishVoting();
      },
    );
  }

  private setPhase(phase: ImpostorPhase): void {
    this.state.phase = phase;
    this.callbacks.onPhaseChange(phase);
    this.callbacks.onStateUpdate();
  }

  private setTimer(name: string, ms: number, callback: () => void): void {
    this.timers.set(name, ms, callback);
  }

  private clearTimer(name: string): void {
    this.timers.clear(name);
  }

  private shuffleArray<T>(arr: T[]): T[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

export const IMPOSTOR_REGISTRATION: GameRegistration = {
  validateStart(
    players: Player[],
    settings: GameSettingsValues,
  ): string | null {
    const lists = getWordListsByIds(
      (settings.selectedWordLists as string[]) ?? [],
    );
    if (!lists.some((list) => list.words.length > 0))
      return 'no_word_lists_selected';
    if ((settings.impostorCount as number) > maxImpostorsFor(players.length)) {
      return 'too_many_impostors';
    }
    return null;
  },
  create(players, settings, callbacks) {
    // Los ajustes ya vienen validados por sanitizeGameSettings.
    return new ImpostorEngine(
      players,
      settings as unknown as ImpostorSettings,
      callbacks,
    );
  },
};
