import type {
  GameDefinition,
  GameSettingSchema,
  GameSettingsValues,
  Locale,
} from '@amonglies/shared';
import { getWordListById, getWordListsByLocale } from '@amonglies/shared';

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
  values[WORD_LISTS_KEY] = getWordListsByLocale(locale).map((list) => list.id);
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

  if (WORD_LISTS_KEY in raw) {
    const lists = sanitizeWordLists(raw[WORD_LISTS_KEY], locale);
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

/** Sólo ids existentes del idioma de la sala, sin repetidos. */
export function sanitizeWordLists(value: unknown, locale: Locale): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.filter(
    (id): id is string =>
      typeof id === 'string' && getWordListById(id)?.locale === locale,
  );
  return [...new Set(ids)];
}
