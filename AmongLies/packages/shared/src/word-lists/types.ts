import type { Locale } from '../types/common';

export interface WordList {
  id: string;
  locale: Locale;
  category: Record<Locale, string>;
  words: string[];
}
