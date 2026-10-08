import type {
  GameDefinition,
  GameSettingSchema,
  GameSettingsValues,
  Locale,
} from '@amonglies/shared';
import type { WordList } from '@amonglies/shared';
import { getWordListById, getWordListsForGame } from '@amonglies/shared';

/** Las listas de palabras se guardan aparte del settingsSchema porque dependen del idioma. */
export const WORD_LISTS_KEY = 'selectedWordLists';

export function getDefaultGameSettings(
  def: GameDefinition,
  locale: Locale,
): GameSettingsValues {
  const values: GameSettingsValues = {};
  for (const schema of def.settingsSchema) {
    values[schema.key] = schema.default;
  }
  if (def.usesWordLists) {
    values[WORD_LISTS_KEY] = getWordListsForGame(def, locale).map(
      (list) => list.id,
    );
  }
  return values;
}

/**
 * Aplica sobre `current` sólo los valores válidos de `input`.
 * Ignora claves desconocidas y tipos incorrectos; los números se recortan al rango.
 */
export function sanitizeGameSettings(
  def: GameDefinition,
  input: unknown,
  current: GameSettingsValues,
  locale: Locale,
  /** Listas del workshop disponibles en la sala. */
  customLists: WordList[] = [],
): GameSettingsValues {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    return current;
  const raw = input as Record<string, unknown>;
  const next = { ...current };

  for (const schema of def.settingsSchema) {
    if (!(schema.key in raw)) continue;
    const value = sanitizeValue(schema, raw[schema.key]);
    if (value !== undefined) next[schema.key] = value;
  }

  if (def.usesWordLists && WORD_LISTS_KEY in raw) {
    const lists = sanitizeWordLists(
      raw[WORD_LISTS_KEY],
      locale,
      def.drawableWordsOnly,
      customLists,
    );
    if (lists.length > 0) next[WORD_LISTS_KEY] = lists;
  }

  return next;
}

function sanitizeValue(schema: GameSettingSchema, value: unknown): unknown {
  switch (schema.type) {
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value))
        return undefined;
      const min = schema.min ?? -Infinity;
      const max = schema.max ?? Infinity;
      return Math.min(max, Math.max(min, Math.round(value)));
    }
    case 'boolean':
      return typeof value === 'boolean' ? value : undefined;
    case 'select':
      return schema.options?.some((option) => option.value === value)
        ? value
        : undefined;
  }
}

/** Sólo ids existentes del idioma de la sala (y dibujables si hace falta), sin repetidos. */
export function sanitizeWordLists(
  value: unknown,
  locale: Locale,
  drawableOnly = false,
  customLists: WordList[] = [],
): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.filter((id): id is string => {
    const list =
      typeof id === 'string'
        ? (getWordListById(id) ?? customLists.find((l) => l.id === id))
        : undefined;
    return list?.locale === locale && (!drawableOnly || list.drawable);
  });
  return [...new Set(ids)];
}

/** Las listas elegidas, sean del juego o del workshop (en el orden elegido). */
export function resolveWordLists(
  ids: unknown,
  customLists: WordList[],
): WordList[] {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((id) =>
      typeof id === 'string'
        ? (getWordListById(id) ?? customLists.find((l) => l.id === id))
        : undefined,
    )
    .filter((list): list is WordList => list !== undefined);
}
