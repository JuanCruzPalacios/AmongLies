import type {
  GameId,
  GameSettingsValues,
  WorkshopContent,
  WorkshopDraft,
  WorkshopError,
  WorkshopItem,
  WordList,
} from '@amonglies/shared';
import {
  WORKSHOP_CATEGORIES,
  WORKSHOP_LIMITS,
  getGameDefinition,
} from '@amonglies/shared';
import {
  WORD_LISTS_KEY,
  getDefaultGameSettings,
  sanitizeGameSettings,
} from '../game/settings.js';

/** Campos editables de un ítem, ya validados. */
export type ItemFields = Pick<
  WorkshopItem,
  | 'kind'
  | 'title'
  | 'description'
  | 'locale'
  | 'category'
  | 'games'
  | 'drawable'
  | 'content'
>;

const fail = (error: WorkshopError) => ({ ok: false as const, error });

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

/**
 * Limpia las palabras: recorta espacios, saca vacías y repetidas (sin importar
 * mayúsculas). Una palabra demasiado larga invalida la lista.
 */
export function sanitizeWords(
  raw: unknown,
): { ok: true; words: string[] } | { ok: false; error: WorkshopError } {
  if (!Array.isArray(raw)) return fail('invalid');
  const seen = new Set<string>();
  const words: string[] = [];
  for (const item of raw) {
    const word = text(item);
    if (!word) continue;
    if (word.length > WORKSHOP_LIMITS.wordMax) return fail('invalid');
    const key = word.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }
  if (words.length < WORKSHOP_LIMITS.wordsMin) return fail('too_few_words');
  if (words.length > WORKSHOP_LIMITS.wordsMax) return fail('too_many_words');
  return { ok: true, words };
}

/** Juegos que pueden usar una lista: el Dibujo sólo las dibujables. */
export function gamesForList(drawable: boolean): GameId[] {
  return drawable ? ['impostor', 'drawing'] : ['impostor'];
}

/** Valida lo que manda el cliente y arma los campos a guardar. */
export function validateDraft(
  draft: unknown,
): { ok: true; fields: ItemFields } | { ok: false; error: WorkshopError } {
  if (typeof draft !== 'object' || draft === null) return fail('invalid');
  const d = draft as Partial<Record<keyof WorkshopDraft, unknown>>;

  const title = text(d.title);
  const description = text(d.description);
  if (
    title.length < WORKSHOP_LIMITS.titleMin ||
    title.length > WORKSHOP_LIMITS.titleMax ||
    description.length > WORKSHOP_LIMITS.descriptionMax
  )
    return fail('invalid');

  if (d.kind === 'word_list') {
    if (d.locale !== 'es' && d.locale !== 'en') return fail('invalid');
    const words = sanitizeWords(d.words);
    if (!words.ok) return words;
    const category = (WORKSHOP_CATEGORIES as readonly unknown[]).includes(
      d.category,
    )
      ? (d.category as string)
      : 'other';
    const drawable = d.drawable === true;
    return {
      ok: true,
      fields: {
        kind: 'word_list',
        title,
        description,
        locale: d.locale,
        category,
        games: gamesForList(drawable),
        drawable,
        content: { words: words.words },
      },
    };
  }

  if (d.kind === 'preset') {
    const def =
      typeof d.gameId === 'string' ? getGameDefinition(d.gameId) : undefined;
    if (!def) return fail('invalid');
    const settings: GameSettingsValues = sanitizeGameSettings(
      def,
      d.settings,
      getDefaultGameSettings(def, 'es'),
      'es',
    );
    // Las listas de palabras dependen del idioma de la sala: no van en el preset.
    delete settings[WORD_LISTS_KEY];
    return {
      ok: true,
      fields: {
        kind: 'preset',
        title,
        description,
        locale: null,
        category: null,
        games: [def.id],
        drawable: false,
        content: { gameId: def.id, settings },
      },
    };
  }

  return fail('invalid');
}

export function sameContent(a: WorkshopContent, b: WorkshopContent): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Lo puede ver (y copiar o usar) quien lo publicó o cualquiera si está publicado. */
export function canSee(item: WorkshopItem, userId: string): boolean {
  return item.published || item.owner_id === userId;
}

/** Una lista del workshop en el formato que usan los juegos. */
export function toWordList(item: WorkshopItem): WordList | null {
  if (item.kind !== 'word_list' || !item.locale || !('words' in item.content))
    return null;
  return {
    id: item.id,
    locale: item.locale,
    category: { es: item.title, en: item.title },
    drawable: item.drawable,
    words: item.content.words,
  };
}
