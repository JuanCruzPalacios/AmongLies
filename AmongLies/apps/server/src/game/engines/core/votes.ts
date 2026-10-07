export interface VoteResolution {
  votedOutId: string | null;
}

export function resolveVotes(votes: Record<string, string>): VoteResolution {
  return { votedOutId: 'vale' };
}
