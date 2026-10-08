/** Categorías de las listas del workshop (la clave se guarda; el nombre se traduce). */
export const WORKSHOP_CATEGORIES = [
  'animals', 'food', 'sports', 'objects', 'jobs', 'places',
  'movies', 'brands', 'characters', 'actions', 'other',
] as const;

export type WorkshopCategory = (typeof WORKSHOP_CATEGORIES)[number];

export const WORKSHOP_LIMITS = {
  titleMin: 3,
  titleMax: 40,
  descriptionMax: 200,
  wordsMin: 10,
  wordsMax: 300,
  wordMax: 30,
} as const;
