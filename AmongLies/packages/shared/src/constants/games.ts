import type { GameDefinition, GameSettingSchema } from '../types/game';

/** Ajustes de la familia Impostor que van al principio (cantidad de partidas e impostores). */
const COMMON_FIRST: GameSettingSchema[] = [
  {
    key: 'partidas',
    label: { es: 'Partidas', en: 'Games' },
    type: 'number',
    default: 3,
    min: 1,
    max: 10,
  },
  {
    key: 'maxRoundsPerPartida',
    label: { es: 'Tope de rondas por partida', en: 'Round limit per game' },
    type: 'number',
    default: 0,
    min: 0,
    max: 20,
    zeroLabel: { es: 'Sin límite', en: 'No limit' },
  },
  {
    key: 'impostorCount',
    label: { es: 'Cantidad de impostores', en: 'Number of impostors' },
    type: 'number',
    default: 1,
    min: 1,
    max: 5,
  },
];

/** Ajustes comunes de discusión y votación (van después de los propios del juego). */
const COMMON_LAST: GameSettingSchema[] = [
  {
    key: 'discussionTimeSeconds',
    label: { es: 'Tiempo de discusion (seg)', en: 'Discussion time (sec)' },
    type: 'number',
    default: 120,
    min: 0,
    max: 300,
  },
  {
    key: 'votingTimeSeconds',
    label: { es: 'Tiempo de votacion (seg)', en: 'Voting time (sec)' },
    type: 'number',
    default: 30,
    min: 10,
    max: 120,
  },
  {
    key: 'secretVote',
    label: { es: 'Voto secreto', en: 'Secret vote' },
    type: 'boolean',
    default: false,
  },
  {
    key: 'allowSkipVote',
    label: { es: 'Permitir votar "saltear"', en: 'Allow "skip" vote' },
    type: 'boolean',
    default: true,
  },
  {
    key: 'tieBreak',
    label: { es: 'Si hay empate', en: 'On a tie' },
    type: 'select',
    default: 'none',
    options: [
      { value: 'none', label: { es: 'Nadie sale', en: 'Nobody is out' } },
      { value: 'revote', label: { es: 'Re-votar', en: 'Vote again' } },
      { value: 'random', label: { es: 'Al azar', en: 'Random' } },
    ],
  },
];

function deductionSchema(own: GameSettingSchema[]): GameSettingSchema[] {
  return [...COMMON_FIRST, ...own, ...COMMON_LAST];
}

export const GAME_IMPOSTOR: GameDefinition = {
  id: 'impostor',
  emoji: '🎭',
  name: {
    es: 'El Impostor',
    en: 'The Impostor',
  },
  description: {
    es: 'Descubre quien no conoce la palabra secreta. El impostor debe pasar desapercibido.',
    en: 'Find out who doesn\'t know the secret word. The impostor must blend in.',
  },
  minPlayers: 4,
  maxPlayers: null,
  supportedModes: ['chat', 'voice'],
  availableLocales: ['es', 'en'],
  usesWordLists: true,
  settingsSchema: deductionSchema([
    {
      key: 'turnTimeSeconds',
      label: { es: 'Tiempo por turno (seg)', en: 'Time per turn (sec)' },
      type: 'number',
      default: 30,
      min: 10,
      max: 120,
    },
    {
      key: 'wordRevealTimeSeconds',
      label: { es: 'Tiempo para ver la palabra (seg)', en: 'Word reveal time (sec)' },
      type: 'number',
      default: 10,
      min: 5,
      max: 30,
    },
    {
      key: 'impostorCategoryHint',
      label: { es: 'El impostor ve la categoría', en: 'Impostor sees the category' },
      type: 'boolean',
      default: false,
    },
    {
      key: 'communicationMode',
      label: { es: 'Modo de comunicacion', en: 'Communication mode' },
      type: 'select',
      default: 'chat',
      options: [
        { value: 'chat', label: { es: 'Chat (texto)', en: 'Chat (text)' } },
        { value: 'voice', label: { es: 'Verbal (voz)', en: 'Verbal (voice)' } },
      ],
    },
  ]),
};

export const GAME_TIME: GameDefinition = {
  id: 'time',
  emoji: '⏱️',
  name: {
    es: 'Impostor por tiempo',
    en: 'Time Impostor',
  },
  description: {
    es: 'Cada uno para un reloj oculto en el tiempo secreto. El impostor no lo sabe: tiene que deducirlo de los demás.',
    en: 'Everyone stops a hidden clock at the secret time. The impostor doesn\'t know it and must guess from the others.',
  },
  minPlayers: 4,
  maxPlayers: null,
  supportedModes: ['chat', 'voice'],
  availableLocales: ['es', 'en'],
  usesWordLists: false,
  settingsSchema: deductionSchema([
    {
      key: 'targetMinSeconds',
      label: { es: 'Tiempo objetivo mínimo (seg)', en: 'Minimum target time (sec)' },
      type: 'number',
      default: 5,
      min: 2,
      max: 30,
    },
    {
      key: 'targetMaxSeconds',
      label: { es: 'Tiempo objetivo máximo (seg)', en: 'Maximum target time (sec)' },
      type: 'number',
      default: 20,
      min: 3,
      max: 60,
    },
    {
      key: 'maxTurnSeconds',
      label: { es: 'Tiempo máximo por turno (seg)', en: 'Max time per turn (sec)' },
      type: 'number',
      default: 30,
      min: 10,
      max: 120,
    },
    {
      key: 'roleRevealTimeSeconds',
      label: { es: 'Tiempo para ver tu rol (seg)', en: 'Role reveal time (sec)' },
      type: 'number',
      default: 8,
      min: 3,
      max: 30,
    },
  ]),
};

export const GAME_DRAWING: GameDefinition = {
  id: 'drawing',
  emoji: '🎨',
  name: {
    es: 'Impostor dibujo',
    en: 'Drawing Impostor',
  },
  description: {
    es: 'Entre todos dibujan la palabra secreta, de a poquito. El impostor no la sabe: tiene que dibujar sin delatarse.',
    en: 'Everyone draws the secret word, a little at a time. The impostor doesn\'t know it and must draw without giving themselves away.',
  },
  minPlayers: 4,
  maxPlayers: null,
  supportedModes: ['chat', 'voice'],
  availableLocales: ['es', 'en'],
  usesWordLists: true,
  drawableWordsOnly: true,
  settingsSchema: deductionSchema([
    {
      key: 'wordRevealTimeSeconds',
      label: { es: 'Tiempo para ver la palabra (seg)', en: 'Word reveal time (sec)' },
      type: 'number',
      default: 8,
      min: 3,
      max: 30,
    },
    {
      key: 'impostorCategoryHint',
      label: { es: 'El impostor ve la categoría', en: 'Impostor sees the category' },
      type: 'boolean',
      default: false,
    },
    {
      key: 'turnsPerRound',
      label: { es: 'Veces que dibuja cada uno por ronda', en: 'Turns per player each round' },
      type: 'number',
      default: 1,
      min: 1,
      max: 3,
    },
    {
      key: 'inkPerTurn',
      label: { es: 'Tinta por turno (% del ancho del lienzo)', en: 'Ink per turn (% of canvas width)' },
      type: 'number',
      default: 100,
      min: 20,
      max: 1000,
    },
    {
      key: 'minInkPercent',
      label: { es: 'Tinta mínima para terminar el turno (%)', en: 'Minimum ink to end the turn (%)' },
      type: 'number',
      default: 20,
      min: 0,
      max: 100,
    },
    {
      key: 'turnTimeSeconds',
      label: { es: 'Tiempo máximo por turno (seg)', en: 'Max time per turn (sec)' },
      type: 'number',
      default: 30,
      min: 10,
      max: 120,
    },
    {
      key: 'colorMode',
      label: { es: 'Colores', en: 'Colors' },
      type: 'select',
      default: 'free',
      options: [
        { value: 'free', label: { es: 'Cada uno elige', en: 'Free choice' } },
        { value: 'per-player', label: { es: 'Uno fijo por jugador', en: 'One per player' } },
      ],
    },
  ]),
};

export const ALL_GAMES: GameDefinition[] = [GAME_IMPOSTOR, GAME_TIME, GAME_DRAWING];

export function getGameDefinition(id: string): GameDefinition | undefined {
  return ALL_GAMES.find((game) => game.id === id);
}
