import type { GameDefinition } from '../types/game';

export const GAME_IMPOSTOR: GameDefinition = {
  id: 'impostor',
  name: {
    es: 'El Impostor',
    en: 'The Impostor',
    pt: 'O Impostor',
  },
  description: {
    es: 'Descubre quien no conoce la palabra secreta. El impostor debe pasar desapercibido.',
    en: 'Find out who doesn\'t know the secret word. The impostor must blend in.',
    pt: 'Descubra quem nao conhece a palavra secreta. O impostor deve passar despercebido.',
  },
  minPlayers: 4,
  maxPlayers: null,
  supportedModes: ['chat', 'voice'],
  availableLocales: ['es', 'en', 'pt'],
  settingsSchema: [
    {
      key: 'rounds',
      label: { es: 'Rondas', en: 'Rounds', pt: 'Rodadas' },
      type: 'number',
      default: 3,
      min: 1,
      max: 10,
    },
    {
      key: 'impostorCount',
      label: { es: 'Cantidad de impostores', en: 'Number of impostors', pt: 'Quantidade de impostores' },
      type: 'number',
      default: 1,
      min: 1,
      max: 5,
    },
    {
      key: 'turnTimeSeconds',
      label: { es: 'Tiempo por turno (seg)', en: 'Time per turn (sec)', pt: 'Tempo por turno (seg)' },
      type: 'number',
      default: 30,
      min: 10,
      max: 120,
    },
    {
      key: 'discussionTimeSeconds',
      label: { es: 'Tiempo de discusion (seg)', en: 'Discussion time (sec)', pt: 'Tempo de discussao (seg)' },
      type: 'number',
      default: 120,
      min: 0,
      max: 300,
    },
    {
      key: 'votingTimeSeconds',
      label: { es: 'Tiempo de votacion (seg)', en: 'Voting time (sec)', pt: 'Tempo de votacao (seg)' },
      type: 'number',
      default: 30,
      min: 10,
      max: 120,
    },
    {
      key: 'wordRevealTimeSeconds',
      label: { es: 'Tiempo para ver la palabra (seg)', en: 'Word reveal time (sec)', pt: 'Tempo para ver a palavra (seg)' },
      type: 'number',
      default: 10,
      min: 5,
      max: 30,
    },
    {
      key: 'communicationMode',
      label: { es: 'Modo de comunicacion', en: 'Communication mode', pt: 'Modo de comunicacao' },
      type: 'select',
      default: 'chat',
      options: [
        { value: 'chat', label: { es: 'Chat (texto)', en: 'Chat (text)', pt: 'Chat (texto)' } },
        { value: 'voice', label: { es: 'Verbal (voz)', en: 'Verbal (voice)', pt: 'Verbal (voz)' } },
      ],
    },
  ],
};

export const ALL_GAMES: GameDefinition[] = [GAME_IMPOSTOR];
