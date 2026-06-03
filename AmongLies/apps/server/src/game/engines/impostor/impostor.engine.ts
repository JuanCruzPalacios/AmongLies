import type {
  ImpostorGameState,
  ImpostorSettings,
  ImpostorPhase,
  ImpostorPlayerView,
  RoundResult,
  Player,
} from '@amonglies/shared';
import { getWordListsByIds } from '@amonglies/shared';

const PARTIDA_END_SECONDS = 15;

export class ImpostorEngine {
  private state: ImpostorGameState;
  private players: Player[];
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private onPhaseChange: (phase: ImpostorPhase) => void;
  private onStateUpdate: () => void;

  constructor(
    players: Player[],
    settings: ImpostorSettings,
    onPhaseChange: (phase: ImpostorPhase) => void,
    onStateUpdate: () => void,
  ) {
    this.players = players;
    this.onPhaseChange = onPhaseChange;
    this.onStateUpdate = onStateUpdate;
    this.state = {
      phase: 'word-reveal',
      partida: 1,
      totalPartidas: settings.rounds,
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
      settings,
      gameWinner: null,
    };
  }

  start(): void {
    this.startPartida();
  }

  getPartida(): number {
    return this.state.partida;
  }

  getRound(): number {
    return this.state.roundWithinPartida;
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
        phase === 'round-end' ||
        phase === 'game-end'
          ? this.state.votes
          : {},
      hasVoted: playerId in this.state.votes,
      voteCount: Object.keys(this.state.votes).length,
      skipDiscussionVotes: [...this.state.skipDiscussionVotes],
      partidaEndSkipVotes: [...this.state.partidaEndSkipVotes],
      results: sanitizedResults,
      settings: this.state.settings,
      timeRemaining: 0,
      gameWinner: this.state.gameWinner,
    };
  }

  handleAction(playerId: string, action: { type: string; payload?: unknown }): string | null {
    switch (action.type) {
      case 'submit-word':
        return this.handleSubmitWord(playerId, action.payload as string);
      case 'ready':
        this.handleReady(playerId);
        break;
      case 'vote':
        this.handleVote(playerId, action.payload as string);
        break;
      case 'advance':
        this.handleAdvance(playerId);
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

  getPhase(): ImpostorPhase {
    return this.state.phase;
  }

  getResults(): RoundResult[] {
    return this.state.results;
  }

  destroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private activePlayers(): Player[] {
    return this.players.filter((p) => !this.state.eliminatedPlayerIds.includes(p.id));
  }

  private activeImpostors(): string[] {
    return this.state.impostorIds.filter(
      (id) => !this.state.eliminatedPlayerIds.includes(id),
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
    if (allWords.length === 0) return;

    this.state.secretWord = allWords[Math.floor(Math.random() * allWords.length)];
    this.state.turnOrder = this.shuffleArray(this.activePlayers().map((p) => p.id));
    this.state.currentTurnIndex = 0;
    this.state.wordsUsed = [];
    this.state.votes = {};
    this.state.skipDiscussionVotes = [];

    this.setPhase('word-reveal');
    this.setTimer('word-reveal', this.state.settings.wordRevealTimeSeconds * 1000, () => {
      this.setPhase('turns');
      if (this.state.settings.communicationMode === 'chat') this.startTurnTimer();
    });
  }

  private selectImpostors(): string[] {
    const count = Math.min(this.state.settings.impostorCount, this.players.length - 1);
    return this.shuffleArray(this.players.map((p) => p.id)).slice(0, count);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  private handleSubmitWord(playerId: string, word: string): string | null {
    if (this.state.phase !== 'turns') return null;
    if (this.state.turnOrder[this.state.currentTurnIndex] !== playerId) return null;
    if (this.state.settings.communicationMode !== 'chat') return null;

    const trimmed = (word || '').trim();
    if (!trimmed) return null;

    if (this.state.wordsUsed.some(
      (w) => w.word.toLowerCase() === trimmed.toLowerCase(),
    )) return 'word_already_used';

    const isImpostor = this.state.impostorIds.includes(playerId);
    if (!isImpostor && trimmed.toLowerCase() === this.state.secretWord.toLowerCase()) {
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

  private handleAdvance(_playerId: string): void {
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
    if (this.state.eliminatedPlayerIds.includes(playerId)) return;

    this.state.skipDiscussionVotes.push(playerId);

    if (this.state.skipDiscussionVotes.length >= this.activePlayers().length) {
      this.clearTimer('discussion');
      this.setPhase('voting');
      this.startVotingTimer();
    } else {
      this.onStateUpdate();
    }
  }

  private handleSkipPartidaEnd(playerId: string): void {
    if (this.state.phase !== 'partida-end') return;
    if (this.state.partidaEndSkipVotes.includes(playerId)) return;

    this.state.partidaEndSkipVotes.push(playerId);

    if (this.state.partidaEndSkipVotes.length >= this.players.length) {
      this.clearTimer('partida-end');
      this.advanceToNextPartida();
    } else {
      this.onStateUpdate();
    }
  }

  private handleVote(playerId: string, targetId: string): void {
    if (this.state.phase !== 'voting') return;
    if (playerId === targetId) return;
    if (playerId in this.state.votes) return;
    if (this.state.eliminatedPlayerIds.includes(playerId)) return;
    if (this.state.eliminatedPlayerIds.includes(targetId)) return;

    this.state.votes[playerId] = targetId;
    this.onStateUpdate();

    if (Object.keys(this.state.votes).length >= this.activePlayers().length) {
      this.clearTimer('voting');
      this.resolveVotes();
    }
  }

  // ─── Turn flow ───────────────────────────────────────────────────────────

  private advanceTurn(): void {
    this.state.currentTurnIndex++;
    if (this.state.currentTurnIndex >= this.state.turnOrder.length) {
      this.setPhase('discussion');
      if (this.state.settings.discussionTimeSeconds > 0) {
        this.setTimer('discussion', this.state.settings.discussionTimeSeconds * 1000, () => {
          this.setPhase('voting');
          this.startVotingTimer();
        });
      } else {
        this.setPhase('voting');
        this.startVotingTimer();
      }
      return;
    }
    this.onStateUpdate();
    if (this.state.settings.communicationMode === 'chat') this.startTurnTimer();
  }

  private resolveVotes(): void {
    const voteCounts = new Map<string, number>();
    for (const targetId of Object.values(this.state.votes)) {
      voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1);
    }

    let maxVotes = 0;
    let votedOutId: string | null = null;
    let tie = false;

    for (const [pid, count] of voteCounts) {
      if (count > maxVotes) { maxVotes = count; votedOutId = pid; tie = false; }
      else if (count === maxVotes) { tie = true; }
    }
    if (tie) votedOutId = null;

    if (votedOutId !== null && !this.state.eliminatedPlayerIds.includes(votedOutId)) {
      this.state.eliminatedPlayerIds.push(votedOutId);
    }

    const remainingImpostors = this.activeImpostors();
    const remainingPlayers = this.activePlayers();
    const remainingInnocents = remainingPlayers.length - remainingImpostors.length;

    const roundWinner: 'players' | 'impostor' | 'tie' =
      votedOutId === null ? 'tie'
      : this.state.impostorIds.includes(votedOutId) ? 'players'
      : 'impostor';

    this.state.results.push({
      partida: this.state.partida,
      ronda: this.state.roundWithinPartida,
      word: this.state.secretWord,
      impostorIds: [...this.state.impostorIds],
      votedOutId,
      impostorGuessedWord: false,
      winner: roundWinner,
    });

    const impostorsEliminated = remainingImpostors.length === 0;
    const impostorsWin = remainingImpostors.length > 0 && remainingImpostors.length >= remainingInnocents;
    const partidaOver = impostorsEliminated || impostorsWin;
    const gameOver = partidaOver && this.state.partida >= this.state.totalPartidas;

    if (partidaOver) {
      this.state.gameWinner = impostorsEliminated ? 'players' : 'impostor';
    }

    this.setPhase('vote-results');

    this.setTimer('vote-results', 9000, () => {
      if (gameOver) {
        this.setPhase('game-end');
      } else if (partidaOver) {
        // Show partida summary before next partida
        this.state.partidaEndSkipVotes = [];
        this.setPhase('partida-end');
        this.setTimer('partida-end', PARTIDA_END_SECONDS * 1000, () => {
          this.advanceToNextPartida();
        });
      } else {
        this.state.roundWithinPartida++;
        this.startRound();
      }
    });
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

  private startVotingTimer(): void {
    this.setTimer('voting', this.state.settings.votingTimeSeconds * 1000, () => {
      this.resolveVotes();
    });
  }

  private setPhase(phase: ImpostorPhase): void {
    this.state.phase = phase;
    this.onPhaseChange(phase);
    this.onStateUpdate();
  }

  private setTimer(name: string, ms: number, callback: () => void): void {
    this.clearTimer(name);
    this.timers.set(name, setTimeout(callback, ms));
  }

  private clearTimer(name: string): void {
    const timer = this.timers.get(name);
    if (timer) { clearTimeout(timer); this.timers.delete(name); }
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
