import type {
  DrawingPhase,
  DrawingRoundResult,
  DrawingSettings,
  GameAction,
  GameSettingsValues,
  Player,
  WordList,
  Stroke,
} from '@amonglies/shared';
import {
  DRAWING_COLORS,
  DRAWING_SIZES,
  MAX_POINTS_PER_MESSAGE,
  MAX_POINTS_PER_TURN,
  clipToInk,
  getWordListsByIds,
  parsePoints,
} from '@amonglies/shared';
import type {
  EngineCallbacks,
  GameRegistration,
  GameView,
} from '../../engine.js';
import { CommonView, DeductionEngine } from '../deduction/deduction.engine.js';
import { maxImpostorsFor } from '../core/rules.js';

/** Margen para comparar tinta (los decimales nunca dan exacto). */
const EPSILON = 1e-9;

/**
 * Impostor dibujo. Por partida hay una sola palabra y un solo lienzo: cada
 * ronda, cada uno agrega un poco al dibujo (con tinta limitada) y después se
 * vota. Si nadie gana, la ronda siguiente sigue sobre el mismo dibujo.
 * Sin deshacer: lo dibujado queda.
 */
export class DrawingEngine extends DeductionEngine<
  'drawing',
  DrawingPhase,
  DrawingSettings,
  DrawingRoundResult
> {
  private secretWord = '';
  private category = '';
  private strokes: Stroke[] = [];
  private lap = 1;
  /** Tinta gastada en el turno en curso (en anchos de lienzo). */
  private inkUsed = 0;
  /** El último trazo es del jugador de turno y todavía acepta puntos. */
  private strokeOpen = false;
  private pointsThisTurn = 0;
  private readonly playerColors: Record<string, string> | null;

  constructor(
    players: Player[],
    settings: DrawingSettings,
    callbacks: EngineCallbacks,
    /** Listas ya resueltas (del juego o del workshop); por defecto, las del juego. */
    private readonly wordLists: WordList[] = getWordListsByIds(
      settings.selectedWordLists,
    ),
  ) {
    super('drawing', players, settings, callbacks);
    this.playerColors =
      settings.colorMode === 'per-player'
        ? Object.fromEntries(
            players.map((p, i) => [
              p.id,
              DRAWING_COLORS[i % DRAWING_COLORS.length],
            ]),
          )
        : null;
  }

  private get inkBudget(): number {
    return this.state.settings.inkPerTurn / 100;
  }

  private get minInk(): number {
    return (this.inkBudget * this.state.settings.minInkPercent) / 100;
  }

  /** Palabra y lienzo nuevos sólo al empezar la partida; las rondas siguientes continúan el dibujo. */
  protected startRoundActivity(): void {
    this.lap = 1;
    if (this.state.roundWithinPartida > 1) {
      this.startTurns();
      return;
    }
    const lists = this.wordLists;
    const words = lists.flatMap((list) =>
      list.words.map((word) => ({
        word,
        category: list.category[list.locale],
      })),
    );
    const pick = words[Math.floor(Math.random() * words.length)];
    this.secretWord = pick.word;
    this.category = pick.category;
    this.strokes = [];

    this.setPhase('word-reveal');
    this.setTimer(
      'word-reveal',
      this.state.settings.wordRevealTimeSeconds * 1000,
      () => this.startTurns(),
    );
  }

  protected startNextLap(): boolean {
    if (this.lap >= this.state.settings.turnsPerRound) return false;
    this.lap++;
    return true;
  }

  protected beginTurn(): void {
    this.inkUsed = 0;
    this.strokeOpen = false;
    this.pointsThisTurn = 0;
    this.setTimer('turn', this.state.settings.turnTimeSeconds * 1000, () =>
      this.endTurn(),
    );
  }

  protected handleActivityAction(
    playerId: string,
    action: GameAction,
  ): string | null | undefined {
    switch (action.type) {
      case 'stroke-start':
        this.handleStrokeStart(playerId, action.payload);
        return null;
      case 'stroke-points':
        this.handleStrokePoints(playerId, action.payload);
        return null;
      case 'end-turn':
        return this.handleEndTurn(playerId);
    }
    return undefined;
  }

  protected roundExtras() {
    return { word: this.secretWord };
  }

  protected buildView(
    playerId: string,
    common: CommonView<
      'drawing',
      DrawingPhase,
      DrawingSettings,
      DrawingRoundResult
    >,
  ): GameView {
    const isImpostor = common.isImpostor;
    const phase = this.state.phase;
    const partidaOver = phase === 'partida-end' || phase === 'game-end';
    return {
      ...common,
      // La palabra sigue en juego toda la partida: no se revela en los
      // resultados de sus rondas hasta que termina.
      results: common.results.map((r) =>
        r.partida === this.state.partida && !partidaOver
          ? { ...r, word: '' }
          : r,
      ),
      secretWord: isImpostor ? null : this.secretWord,
      category:
        !isImpostor || this.state.settings.impostorCategoryHint
          ? this.category
          : null,
      strokes: this.strokes,
      lap: this.lap,
      inkUsed: this.inkUsed,
      inkBudget: this.inkBudget,
      playerColors: this.playerColors,
    };
  }

  // ─── Acciones ────────────────────────────────────────────────────────────

  private isCurrentTurn(playerId: string): boolean {
    return (
      this.state.phase === 'turns' && this.currentTurnPlayerId() === playerId
    );
  }

  private handleStrokeStart(playerId: string, payload: unknown): void {
    if (!this.isCurrentTurn(playerId)) return;
    if (this.inkUsed >= this.inkBudget - EPSILON) return;
    if (this.pointsThisTurn >= MAX_POINTS_PER_TURN) return;

    const data = (payload ?? {}) as {
      x?: unknown;
      y?: unknown;
      color?: unknown;
      size?: unknown;
    };
    const start = parsePoints([data.x, data.y], 1);
    if (!start) return;
    const color = this.playerColors ? this.playerColors[playerId] : data.color;
    if (!(DRAWING_COLORS as readonly unknown[]).includes(color)) return;
    if (!(DRAWING_SIZES as readonly unknown[]).includes(data.size)) return;

    const stroke: Stroke = {
      playerId,
      color: color as string,
      size: data.size as number,
      points: start,
    };
    this.strokes.push(stroke);
    this.strokeOpen = true;
    this.pointsThisTurn++;
    this.callbacks.onDraw?.({
      kind: 'start',
      stroke: { ...stroke, points: [...start] },
    });
  }

  private handleStrokePoints(playerId: string, payload: unknown): void {
    if (!this.isCurrentTurn(playerId) || !this.strokeOpen) return;
    const max = Math.min(
      MAX_POINTS_PER_MESSAGE,
      MAX_POINTS_PER_TURN - this.pointsThisTurn,
    );
    if (max <= 0) return;
    const points = parsePoints(
      (payload as { points?: unknown } | undefined)?.points,
      max,
    );
    if (!points) return;

    const stroke = this.strokes[this.strokes.length - 1];
    const n = stroke.points.length;
    const clipped = clipToInk(
      [stroke.points[n - 2], stroke.points[n - 1]],
      points,
      this.inkBudget - this.inkUsed,
    );
    if (clipped.points.length > 0) {
      stroke.points.push(...clipped.points);
      this.inkUsed += clipped.used;
      this.pointsThisTurn += clipped.points.length / 2;
      this.callbacks.onDraw?.({ kind: 'points', points: clipped.points });
    }
    // Sin tinta no queda nada por hacer: pasa el turno.
    if (this.inkUsed >= this.inkBudget - EPSILON) this.endTurn();
  }

  private handleEndTurn(playerId: string): string | null {
    if (!this.isCurrentTurn(playerId)) return null;
    if (this.inkUsed < this.minInk - EPSILON) return 'not_enough_ink';
    this.endTurn();
    return null;
  }

  private endTurn(): void {
    this.clearTimer('turn');
    this.strokeOpen = false;
    this.nextTurn();
  }
}

export const DRAWING_REGISTRATION: GameRegistration = {
  validateStart(
    players: Player[],
    settings: GameSettingsValues,
    wordLists?: WordList[],
  ): string | null {
    const lists =
      wordLists ??
      getWordListsByIds((settings.selectedWordLists as string[]) ?? []);
    if (!lists.some((list) => list.drawable && list.words.length > 0))
      return 'no_word_lists_selected';
    if ((settings.impostorCount as number) > maxImpostorsFor(players.length)) {
      return 'too_many_impostors';
    }
    return null;
  },
  create(players, settings, callbacks, wordLists) {
    // Los ajustes ya vienen validados por sanitizeGameSettings.
    return new DrawingEngine(
      players,
      settings as unknown as DrawingSettings,
      callbacks,
      wordLists,
    );
  },
};
