import type { Locale } from '../types/common';

export interface WordList {
  id: string;
  locale: Locale;
  category: Record<Locale, string>;
  /** Son cosas concretas que se pueden dibujar (las acepta el juego de Dibujo). */
  drawable: boolean;
  words: string[];
}
