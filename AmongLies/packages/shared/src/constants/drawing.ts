/** Relación de aspecto fija del lienzo (ancho / alto). */
export const DRAWING_ASPECT = 4 / 3;

/** Colores del pincel (y los que se asignan en el modo "color por jugador"). */
export const DRAWING_COLORS = [
  '#1f2937', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#a16207',
] as const;

/** Grosores del pincel, en fracción del ancho del lienzo. */
export const DRAWING_SIZES = [0.006, 0.012, 0.024] as const;

/** Límites anti-abuso: puntos por mensaje y por turno. */
export const MAX_POINTS_PER_MESSAGE = 120;
export const MAX_POINTS_PER_TURN = 1500;
