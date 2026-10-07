import type { GameDefinition } from '../types/game';

export const GAME_IMPOSTOR: GameDefinition = {
  id: 'impostor',
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
  settingsSchema: [
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
    {
      key: 'turnTimeSeconds',
      label: { es: 'Tiempo por turno (seg)', en: 'Time per turn (sec)' },
      type: 'number',
      default: 30,
      min: 10,
      max: 120,
    },
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
      key: 'wordRevealTimeSeconds',
      label: { es: 'Tiempo para ver la palabra (seg)', en: 'Word reveal time (sec)' },
      type: 'number',
      default: 10,
      min: 5,
      max: 30,
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
  ],
};

export const ALL_GAMES: GameDefinition[] = [GAME_IMPOSTOR];

export function getGameDefinition(id: string): GameDefinition | undefined {
  return ALL_GAMES.find((game) => game.id === id);
}
