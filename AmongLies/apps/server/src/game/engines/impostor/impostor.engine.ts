import type {
  GameAction,
  GameSettingsValues,
  ImpostorPhase,
  ImpostorSettings,
  Player,
  WordList,
  RoundResult,
  WordEntry,
} from '@amonglies/shared';
import {
  MAX_CHAT_MESSAGE_LENGTH,
  censor,
  getWordListsByIds,
} from '@amonglies/shared';
import type {
  ActionContext,
  EngineCallbacks,
  GameRegistration,
  GameView,
} from '../../engine.js';
import { CommonView, DeductionEngine } from '../deduction/deduction.engine.js';
import { maxImpostorsFor } from '../core/rules.js';

/**
 * El Impostor clásico: los inocentes reciben una palabra secreta y, por
 * turnos, dan una pista (por chat o en voz alta). El impostor no la sabe.
 */
export class ImpostorEngine extends DeductionEngine<
  'impostor',
  ImpostorPhase,
  ImpostorSettings,
  RoundResult
> {
  private secretWord = '';
  private category = '';
  private wordsUsed: WordEntry[] = [];

  constructor(
    players: Player[],
    settings: ImpostorSettings,
    callbacks: EngineCallbacks,
    /** Listas ya resueltas (del juego o del workshop); por defecto, las del juego. */
    private readonly wordLists: WordList[] = getWordListsByIds(
      settings.selectedWordLists,
    ),
  ) {
    super('impostor', players, settings, callbacks);
  }

  protected startRoundActivity(): void {
    const wordLists = this.wordLists;
    const allWords = wordLists.flatMap((list) =>
      list.words.map((word) => ({
        word,
        category: list.category[list.locale],
      })),
    );
    const pick = allWords[Math.floor(Math.random() * allWords.length)];
    this.secretWord = pick.word;
    this.category = pick.category;
    this.wordsUsed = [];

    this.setPhase('word-reveal');
    this.setTimer(
      'word-reveal',
      this.state.settings.wordRevealTimeSeconds * 1000,
      () => this.startTurns(),
    );
  }

  protected beginTurn(): void {
    if (this.state.settings.communicationMode !== 'chat') return;
    this.setTimer('turn', this.state.settings.turnTimeSeconds * 1000, () => {
      this.wordsUsed.push({
        playerId: this.currentTurnPlayerId()!,
        word: '(timeout)',
      });
      this.nextTurn();
    });
  }

  protected handleActivityAction(
    playerId: string,
    action: GameAction,
    ctx: ActionContext,
  ): string | null | undefined {
    switch (action.type) {
      case 'submit-word':
        return this.handleSubmitWord(playerId, action.payload);
      case 'ready':
        this.handleReady(playerId);
        return null;
      case 'advance':
        if (!ctx.isAdmin) return 'not_admin';
        this.handleAdvance();
        return null;
    }
    return undefined;
  }

  protected roundExtras() {
    return { word: this.secretWord };
  }

  protected buildView(
    playerId: string,
    common: CommonView<
      'impostor',
      ImpostorPhase,
      ImpostorSettings,
      RoundResult
    >,
  ): GameView {
    const isImpostor = common.isImpostor;
    return {
      ...common,
      secretWord: isImpostor ? null : this.secretWord,
      category:
        !isImpostor || this.state.settings.impostorCategoryHint
          ? this.category
          : null,
      wordsUsed: this.wordsUsed,
    };
  }

  // ─── Acciones ────────────────────────────────────────────────────────────

  private isCurrentTurn(playerId: string): boolean {
    return (
      this.state.phase === 'turns' && this.currentTurnPlayerId() === playerId
    );
  }

  private handleSubmitWord(playerId: string, word: unknown): string | null {
    if (!this.isCurrentTurn(playerId)) return null;
    if (this.state.settings.communicationMode !== 'chat') return null;
    if (typeof word !== 'string') return null;

    const trimmed = word.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
    if (!trimmed) return null;

    if (
      this.wordsUsed.some((w) => w.word.toLowerCase() === trimmed.toLowerCase())
    )
      return 'word_already_used';

    if (
      !this.isImpostor(playerId) &&
      trimmed.toLowerCase() === this.secretWord.toLowerCase()
    ) {
      return 'word_is_secret';
    }

    this.wordsUsed.push({ playerId, word: censor(trimmed) });
    this.clearTimer('turn');
    this.nextTurn();
    return null;
  }

  private handleReady(playerId: string): void {
    if (!this.isCurrentTurn(playerId)) return;
    if (this.state.settings.communicationMode !== 'voice') return;
    this.wordsUsed.push({ playerId, word: '(verbal)' });
    this.nextTurn();
  }

  /** El admin saltea al jugador que está hablando (modo voz). */
  private handleAdvance(): void {
    if (this.state.phase !== 'turns') return;
    if (this.state.settings.communicationMode !== 'voice') return;
    const current = this.currentTurnPlayerId()!;
    if (!this.wordsUsed.some((w) => w.playerId === current)) {
      this.wordsUsed.push({ playerId: current, word: '(skipped)' });
    }
    this.nextTurn();
  }
}

export const IMPOSTOR_REGISTRATION: GameRegistration = {
  validateStart(
    players: Player[],
    settings: GameSettingsValues,
    wordLists?: WordList[],
  ): string | null {
    const lists =
      wordLists ??
      getWordListsByIds((settings.selectedWordLists as string[]) ?? []);
    if (!lists.some((list) => list.words.length > 0))
      return 'no_word_lists_selected';
    if ((settings.impostorCount as number) > maxImpostorsFor(players.length)) {
      return 'too_many_impostors';
    }
    return null;
  },
  create(players, settings, callbacks, wordLists) {
    // Los ajustes ya vienen validados por sanitizeGameSettings.
    return new ImpostorEngine(
      players,
      settings as unknown as ImpostorSettings,
      callbacks,
      wordLists,
    );
  },
};
