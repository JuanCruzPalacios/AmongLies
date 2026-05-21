import type { Locale } from '../types/common';
import type { WordList } from './types';
import { ES_WORD_LISTS } from './es';
import { EN_WORD_LISTS } from './en';
import { PT_WORD_LISTS } from './pt';

export type { WordList } from './types';

const WORD_LISTS_BY_LOCALE: Record<Locale, WordList[]> = {
  es: ES_WORD_LISTS,
  en: EN_WORD_LISTS,
  pt: PT_WORD_LISTS,
};

export function getWordListsByLocale(locale: Locale): WordList[] {
  return WORD_LISTS_BY_LOCALE[locale] ?? WORD_LISTS_BY_LOCALE.es;
}

export function getWordListById(id: string): WordList | undefined {
  const allLists = [...ES_WORD_LISTS, ...EN_WORD_LISTS, ...PT_WORD_LISTS];
  return allLists.find((list) => list.id === id);
}

export function getWordListsByIds(ids: string[]): WordList[] {
  const allLists = [...ES_WORD_LISTS, ...EN_WORD_LISTS, ...PT_WORD_LISTS];
  return allLists.filter((list) => ids.includes(list.id));
}
