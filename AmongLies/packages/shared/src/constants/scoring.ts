/**
 * Puntaje de la familia Impostor. Los inocentes suman por votar bien y por ganar;
 * los impostores, por sobrevivir cada ronda y por ganar la partida.
 */
export const SCORING = {
  /** Inocente que vota a un impostor (por ronda). */
  innocentCorrectVote: 2,
  /** Cada inocente, si su equipo gana la partida. */
  innocentPartidaWin: 1,
  /** Impostor que no es expulsado en la ronda (incluye empate). */
  impostorSurvivesRound: 2,
  /** Cada impostor, si su equipo gana la partida. */
  impostorPartidaWin: 3,
} as const;
