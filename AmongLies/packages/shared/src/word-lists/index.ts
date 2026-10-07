import type { Locale } from '../types/common';
import type { WordList } from './types';
import { ES_WORD_LISTS } from './es';
import { EN_WORD_LISTS } from './en';

export type { WordList } from './types';

const WORD_LISTS_BY_LOCALE: Record<Locale, WordList[]> = {
  es: ES_WORD_LISTS,
  en: EN_WORD_LISTS,
};

const ALL_WORD_LISTS: WordList[] = [...ES_WORD_LISTS, ...EN_WORD_LISTS];

export function getWordListsByLocale(locale: Locale): WordList[] {
  return WORD_LISTS_BY_LOCALE[locale] ?? WORD_LISTS_BY_LOCALE.es;
}

export function getWordListById(id: string): WordList | undefined {
  return ALL_WORD_LISTS.find((list) => list.id === id);
}

export function getWordListsByIds(ids: string[]): WordList[] {
  return ALL_WORD_LISTS.filter((list) => ids.includes(list.id));
}
