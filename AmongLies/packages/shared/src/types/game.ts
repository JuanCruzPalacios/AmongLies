import type { Locale, CommunicationMode } from './common';

export interface GameDefinition {
  id: string;
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  minPlayers: number;
  maxPlayers: number | null;
  supportedModes: CommunicationMode[];
  settingsSchema: GameSettingSchema[];
  availableLocales: Locale[];
}

export interface GameSettingSchema {
  key: string;
  label: Record<Locale, string>;
  type: 'number' | 'boolean' | 'select';
  default: unknown;
  min?: number;
  max?: number;
  options?: { value: string; label: Record<Locale, string> }[];
}

export interface GameAction {
  type: string;
  payload?: unknown;
}
