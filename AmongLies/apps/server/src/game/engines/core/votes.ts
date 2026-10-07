export interface VoteResolution {
  /** Jugador expulsado, o null si nadie votó o hubo empate en el máximo. */
  votedOutId: string | null;
  /** Cantidad de votos recibidos por cada jugador votado. */
  counts: Record<string, number>;
}

/** Cuenta los votos (votante → votado) y decide a quién se expulsa. */
export function resolveVotes(votes: Record<string, string>): VoteResolution {
  const counts: Record<string, number> = {};
  for (const targetId of Object.values(votes)) {
    counts[targetId] = (counts[targetId] ?? 0) + 1;
  }

  const maxVotes = Math.max(0, ...Object.values(counts));
  const leaders = Object.keys(counts).filter((id) => counts[id] === maxVotes);

  return {
    votedOutId: leaders.length === 1 ? leaders[0] : null,
    counts,
  };
}
