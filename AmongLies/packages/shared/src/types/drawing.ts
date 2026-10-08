import type { DeductionPlayerView, DeductionRoundResult, DeductionSettings } from './deduction';

/**
 * Impostor dibujo: una palabra, un lienzo y los mismos impostores por partida.
 * Cada ronda, cada jugador agrega un poco al mismo dibujo (con tinta limitada)
 * y después se vota; si nadie gana, se sigue sobre el mismo dibujo.
 */
export type DrawingPhase = 'word-reveal' | 'turns';

export type DrawingColorMode = 'free' | 'per-player';

export interface DrawingSettings extends DeductionSettings {
  wordRevealTimeSeconds: number;
  selectedWordLists: string[];
  impostorCategoryHint: boolean;
  /** Cuántas veces dibuja cada uno por ronda. */
  turnsPerRound: number;
  /** Tinta por turno, en % del ancho del lienzo (100 = una línea de lado a lado). */
  inkPerTurn: number;
  /** Tinta mínima para poder terminar el turno, en % de la tinta del turno. */
  minInkPercent: number;
  /** Timer de seguridad: el turno se corta solo. */
  turnTimeSeconds: number;
  colorMode: DrawingColorMode;
}

/**
 * Un trazo. Los puntos van aplanados `[x0, y0, x1, y1, …]` y normalizados a 0–1
 * (x sobre el ancho, y sobre el alto), así se ve igual en cualquier pantalla.
 */
export interface Stroke {
  playerId: string;
  color: string;
  size: number;
  points: number[];
}

/** Lo que se transmite en vivo mientras alguien dibuja (para no reenviar todo el estado). */
export type DrawEvent =
  | { kind: 'start'; stroke: Stroke }
  | { kind: 'points'; points: number[] };

export interface DrawingRoundResult extends DeductionRoundResult {
  word: string;
}

export interface DrawingPlayerView
  extends DeductionPlayerView<'drawing', DrawingPhase, DrawingSettings, DrawingRoundResult> {
  secretWord: string | null;
  category: string | null;
  /** Todo el dibujo de la partida, incluido el trazo en curso. */
  strokes: Stroke[];
  /** Vuelta de la ronda en curso (1 … turnsPerRound). */
  lap: number;
  /** Tinta del turno en curso, en anchos de lienzo. */
  inkUsed: number;
  inkBudget: number;
  /** Color de cada jugador, si el modo de color es por jugador. */
  playerColors: Record<string, string> | null;
}
