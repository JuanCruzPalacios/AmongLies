import type { Locale } from '../types/common';

export interface WordList {
  id: string;
  category: Record<Locale, string>;
  words: string[];
}
