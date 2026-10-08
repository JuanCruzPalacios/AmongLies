import type { Locale, CommunicationMode } from './common';

export type GameId = 'impostor' | 'time' | 'drawing';

export interface GameDefinition {
  id: GameId;
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  minPlayers: number;
  maxPlayers: number | null;
  supportedModes: CommunicationMode[];
  settingsSchema: GameSettingSchema[];
  availableLocales: Locale[];
  /** Usa listas de palabras (se eligen en el lobby). */
  usesWordLists: boolean;
  /** Sólo acepta listas de palabras dibujables. */
  drawableWordsOnly?: boolean;
  emoji: string;
}

export interface GameSettingSchema {
  key: string;
  label: Record<Locale, string>;
  type: 'number' | 'boolean' | 'select';
  default: unknown;
  min?: number;
  max?: number;
  /** Texto a mostrar cuando el valor numérico es 0 (p. ej. "Sin límite"). */
  zeroLabel?: Record<Locale, string>;
  options?: { value: string; label: Record<Locale, string> }[];
}

export type GameSettingsValues = Record<string, unknown>;

export interface GameAction {
  type: string;
  payload?: unknown;
}
