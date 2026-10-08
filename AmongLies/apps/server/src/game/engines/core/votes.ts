import { SKIP_VOTE, type TieBreak } from '@amonglies/shared';

export interface VoteResolution {
  /** Jugador expulsado, o null si nadie votó o hubo empate en el máximo. */
  votedOutId: string | null;
  /** Cantidad de votos recibidos por cada jugador votado. */
  counts: Record<string, number>;
  /** Los más votados (más de uno = empate). Vacío si nadie votó. */
  leaders: string[];
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
    leaders,
  };
}

export type VoteOutcome =
  | { kind: 'expel'; playerId: string; tieBreak: 'random' | null }
  | { kind: 'none'; tieBreak: 'random' | null }
  | { kind: 'revote'; candidates: string[] };

/**
 * Decide qué pasa con el resultado de una votación según las reglas de la sala.
 * Si gana "saltear" no sale nadie. El re-voto se hace una sola vez.
 */
export function decideVoteOutcome(
  { leaders }: VoteResolution,
  options: {
    tieBreak: TieBreak;
    alreadyRevoted: boolean;
    random?: () => number;
  },
): VoteOutcome {
  if (leaders.length === 0) return { kind: 'none', tieBreak: null };
  if (leaders.length === 1) {
    return leaders[0] === SKIP_VOTE
      ? { kind: 'none', tieBreak: null }
      : { kind: 'expel', playerId: leaders[0], tieBreak: null };
  }

  if (options.tieBreak === 'revote' && !options.alreadyRevoted) {
    const candidates = leaders.filter((id) => id !== SKIP_VOTE);
    if (candidates.length >= 2) return { kind: 'revote', candidates };
  }

  if (options.tieBreak === 'random') {
    const random = options.random ?? Math.random;
    const pick = leaders[Math.floor(random() * leaders.length)];
    return pick === SKIP_VOTE
      ? { kind: 'none', tieBreak: 'random' }
      : { kind: 'expel', playerId: pick, tieBreak: 'random' };
  }

  return { kind: 'none', tieBreak: null };
}
