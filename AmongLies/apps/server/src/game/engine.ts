import type {
  GameAction,
  GameSettingsValues,
  ImpostorPlayerView,
  Player,
} from '@amonglies/shared';

/** Vista del estado que recibe cada jugador (una por juego). */
export type GameView = ImpostorPlayerView;

export interface EngineCallbacks {
  /** El estado cambió: hay que reenviar la vista a cada jugador. */
  onStateUpdate: () => void;
  onPhaseChange: (phase: string) => void;
  /** Empieza una ronda nueva (para el separador del chat). */
  onRoundStart: (info: { partida: number; ronda: number }) => void;
  onGameEnd: () => void;
}

export interface ActionContext {
  isAdmin: boolean;
}

/** Contrato que cumple cada minijuego. El resto del servidor sólo conoce esto. */
export interface GameEngine {
  start(): void;
  /** Devuelve un código de error o null si la acción se aplicó (o se ignoró). */
  handleAction(
    playerId: string,
    action: GameAction,
    ctx: ActionContext,
  ): string | null;
  getStateForPlayer(playerId: string): GameView;
  /** Los eliminados no pueden chatear durante la partida. */
  canChat(playerId: string): boolean;
  hasPlayer(playerId: string): boolean;
  /** Congela la partida mientras falta alguien. */
  pause(): void;
  resume(): void;
  /** Saca a un jugador que se fue o con el que no se espera más. */
  removePlayer(playerId: string): void;
  /** Estadísticas de los jugadores al terminar el juego (para guardarlas en sus cuentas). */
  getPlayerStats(): PlayerGameStats[];
  destroy(): void;
}

export interface GameRegistration {
  /** Error de inicio (p. ej. demasiados impostores) o null si se puede empezar. */
  validateStart(players: Player[], settings: GameSettingsValues): string | null;
  create(
    players: Player[],
    settings: GameSettingsValues,
    callbacks: EngineCallbacks,
  ): GameEngine;
}

/** Lo que se suma a las estadísticas de una cuenta al terminar un juego. */
export interface PlayerGameStats {
  playerId: string;
  partidasPlayed: number;
  partidasAsImpostor: number;
  partidasWonAsImpostor: number;
  partidasAsInnocent: number;
  partidasWonAsInnocent: number;
  /** Votos de este jugador, como inocente, que fueron a un impostor. */
  correctVotes: number;
  innocentVotes: number;
  points: number;
}
