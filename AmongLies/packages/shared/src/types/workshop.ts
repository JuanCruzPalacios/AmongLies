import type { Locale } from './common';
import type { GameId, GameSettingsValues } from './game';

export type WorkshopKind = 'word_list' | 'preset';

export type WorkshopContent =
  | { words: string[] }
  | { gameId: GameId; settings: GameSettingsValues };

/** Una fila de `workshop_items` (como la devuelve Supabase). */
export interface WorkshopItem {
  id: string;
  owner_id: string;
  kind: WorkshopKind;
  title: string;
  description: string;
  locale: Locale | null;
  category: string | null;
  games: GameId[];
  drawable: boolean;
  content: WorkshopContent;
  version: number;
  published: boolean;
  source_id: string | null;
  source_version: number | null;
  modified: boolean;
  likes_count: number;
  created_at: string;
  updated_at: string;
}

/** Lo que manda el cliente para crear o editar (el servidor valida todo). */
export interface WorkshopDraft {
  id?: string;
  kind: WorkshopKind;
  title: string;
  description?: string;
  locale?: Locale;
  category?: string;
  drawable?: boolean;
  words?: string[];
  gameId?: GameId;
  settings?: GameSettingsValues;
}

export type WorkshopError =
  | 'guest'
  | 'invalid'
  | 'not_found'
  | 'not_owner'
  | 'too_few_words'
  | 'too_many_words'
  | 'unavailable';

export type WorkshopAck = (
  result: { ok: true; id?: string } | { ok: false; error: WorkshopError },
) => void;
