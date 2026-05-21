import type {
  ImpostorGameState,
  ImpostorSettings,
  ImpostorPhase,
  ImpostorPlayerView,
  RoundResult,
  Player,
} from '@amonglies/shared';
import { getWordListsByIds } from '@amonglies/shared';

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
      round: 1,
      totalRounds: settings.rounds,
      secretWord: '',
      impostorIds: [],
      turnOrder: [],
      currentTurnIndex: 0,
      wordsUsed: [],
      votes: {},
      results: [],
      settings,
    };
  }

  start(): void {
    this.startRound();
  }

  getStateForPlayer(playerId: string): ImpostorPlayerView {
    const isImpostor = this.state.impostorIds.includes(playerId);
    const turnIdx = this.state.turnOrder.indexOf(playerId);

    return {
      phase: this.state.phase,
      round: this.state.round,
      totalRounds: this.state.totalRounds,
      isImpostor,
      secretWord: isImpostor ? null : this.state.secretWord,
      fellowImpostorIds: isImpostor
        ? this.state.impostorIds.filter((id) => id !== playerId)
        : [],
      turnOrder: this.state.turnOrder,
      currentTurnIndex: this.state.currentTurnIndex,
      isMyTurn: this.state.phase === 'turns' && this.state.turnOrder[this.state.currentTurnIndex] === playerId,
      wordsUsed: this.state.wordsUsed,
      votes: this.state.phase === 'vote-results' || this.state.phase === 'round-end' || this.state.phase === 'game-end'
        ? this.state.votes
        : {},
      hasVoted: playerId in this.state.votes,
      results: this.state.results,
      settings: this.state.settings,
      timeRemaining: 0,
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
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  private startRound(): void {
    const wordLists = getWordListsByIds(this.state.settings.selectedWordLists);
    const allWords = wordLists.flatMap((wl) => wl.words);
    if (allWords.length === 0) {
      return;
    }

    this.state.secretWord = allWords[Math.floor(Math.random() * allWords.length)];
    this.state.impostorIds = this.selectImpostors();
    this.state.turnOrder = this.shuffleArray(this.players.map((p) => p.id));
    this.state.currentTurnIndex = 0;
    this.state.wordsUsed = [];
    this.state.votes = {};

    this.setPhase('word-reveal');
    this.setTimer('word-reveal', this.state.settings.wordRevealTimeSeconds * 1000, () => {
      this.setPhase('turns');
      if (this.state.settings.communicationMode === 'chat') {
        this.startTurnTimer();
      }
    });
  }

  private selectImpostors(): string[] {
    const count = Math.min(this.state.settings.impostorCount, this.players.length - 1);
    const shuffled = this.shuffleArray([...this.players.map((p) => p.id)]);
    return shuffled.slice(0, count);
  }

  private handleSubmitWord(playerId: string, word: string): string | null {
    if (this.state.phase !== 'turns') return null;
    if (this.state.turnOrder[this.state.currentTurnIndex] !== playerId) return null;
    if (this.state.settings.communicationMode !== 'chat') return null;

    const trimmed = (word || '').trim();
    if (!trimmed) return null;

    const alreadyUsed = this.state.wordsUsed.some(
      (w) => w.word.toLowerCase() === trimmed.toLowerCase(),
    );
    if (alreadyUsed) return 'word_already_used';

    if (trimmed.toLowerCase() === this.state.secretWord.toLowerCase()) {
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

    const currentPlayer = this.state.turnOrder[this.state.currentTurnIndex];
    if (!this.state.wordsUsed.some((w) => w.playerId === currentPlayer)) {
      this.state.wordsUsed.push({ playerId: currentPlayer, word: '(skipped)' });
    }
    this.advanceTurn();
  }

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
    if (this.state.settings.communicationMode === 'chat') {
      this.startTurnTimer();
    }
  }

  private handleVote(playerId: string, targetId: string): void {
    if (this.state.phase !== 'voting') return;
    if (playerId === targetId) return;
    if (playerId in this.state.votes) return;

    this.state.votes[playerId] = targetId;
    this.onStateUpdate();

    const totalPlayers = this.players.length;
    const totalVotes = Object.keys(this.state.votes).length;
    if (totalVotes >= totalPlayers) {
      this.clearTimer('voting');
      this.resolveVotes();
    }
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
      if (count > maxVotes) {
        maxVotes = count;
        votedOutId = pid;
        tie = false;
      } else if (count === maxVotes) {
        tie = true;
      }
    }

    if (tie) votedOutId = null;

    const impostorCaught = votedOutId !== null && this.state.impostorIds.includes(votedOutId);

    const result: RoundResult = {
      round: this.state.round,
      word: this.state.secretWord,
      impostorIds: [...this.state.impostorIds],
      votedOutId,
      impostorGuessedWord: false,
      winner: impostorCaught ? 'players' : 'impostor',
    };

    this.state.results.push(result);
    this.setPhase('vote-results');

    this.setTimer('vote-results', 8000, () => {
      if (this.state.round >= this.state.totalRounds) {
        this.setPhase('game-end');
      } else {
        this.state.round++;
        this.startRound();
      }
    });
  }

  private startTurnTimer(): void {
    this.setTimer('turn', this.state.settings.turnTimeSeconds * 1000, () => {
      const currentPlayer = this.state.turnOrder[this.state.currentTurnIndex];
      this.state.wordsUsed.push({ playerId: currentPlayer, word: '(timeout)' });
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
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(name);
    }
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
