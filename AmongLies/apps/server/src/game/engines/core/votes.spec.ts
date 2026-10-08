import { SKIP_VOTE } from '@amonglies/shared';
import { decideVoteOutcome, resolveVotes } from './votes.js';

// Requerimiento: el jugador con más votos es expulsado. Si hay empate
// en el máximo, o nadie votó, no se expulsa a nadie.
describe('resolveVotes', () => {
  it('expulsa al jugador con más votos', () => {
    const result = resolveVotes({ ana: 'vale', lucas: 'vale', vale: 'ana' });
    expect(result.votedOutId).toBe('vale');
  });

  it('expulsa a otro jugador si es el más votado', () => {
    const result = resolveVotes({ ana: 'lucas', vale: 'lucas', lucas: 'ana' });
    expect(result.votedOutId).toBe('lucas');
  });

  it('con un único voto expulsa a ese jugador', () => {
    expect(resolveVotes({ ana: 'diego' }).votedOutId).toBe('diego');
  });

  it('sin votos no expulsa a nadie', () => {
    expect(resolveVotes({}).votedOutId).toBeNull();
  });

  it('con empate en el máximo no expulsa a nadie', () => {
    const result = resolveVotes({ ana: 'vale', vale: 'ana' });
    expect(result.votedOutId).toBeNull();
  });

  it('un empate por debajo del máximo no impide la expulsión', () => {
    // vale: 3 votos; ana y lucas: 1 cada uno (empatados, pero no son el máximo)
    const result = resolveVotes({
      a: 'vale',
      b: 'vale',
      c: 'vale',
      d: 'ana',
      e: 'lucas',
    });
    expect(result.votedOutId).toBe('vale');
  });

  it('el empate se detecta aunque el empatado aparezca después del líder', () => {
    // Orden de inserción: vale llega primero a 2, después ana también llega a 2
    const result = resolveVotes({ a: 'vale', b: 'vale', c: 'ana', d: 'ana' });
    expect(result.votedOutId).toBeNull();
  });

  it('cuenta los votos de cada jugador', () => {
    const result = resolveVotes({ a: 'vale', b: 'vale', c: 'ana' });
    expect(result.counts).toEqual({ vale: 2, ana: 1 });
  });
});

describe('resolveVotes — leaders', () => {
  it('devuelve a los empatados en el máximo', () => {
    expect(
      resolveVotes({
        a: 'vale',
        b: 'ana',
        c: 'lucas',
        d: 'vale',
        e: 'ana',
      }).leaders.sort(),
    ).toEqual(['ana', 'vale']);
  });

  it('sin votos no hay líderes', () => {
    expect(resolveVotes({}).leaders).toEqual([]);
  });
});

describe('decideVoteOutcome', () => {
  const decide = (
    votes: Record<string, string>,
    tieBreak: 'none' | 'revote' | 'random',
    alreadyRevoted = false,
    random?: () => number,
  ) =>
    decideVoteOutcome(resolveVotes(votes), {
      tieBreak,
      alreadyRevoted,
      random,
    });

  it('expulsa al más votado', () => {
    expect(decide({ a: 'vale', b: 'vale', c: 'ana' }, 'none')).toEqual({
      kind: 'expel',
      playerId: 'vale',
      tieBreak: null,
    });
  });

  it('si gana "saltear" no sale nadie', () => {
    expect(decide({ a: SKIP_VOTE, b: SKIP_VOTE, c: 'ana' }, 'none')).toEqual({
      kind: 'none',
      tieBreak: null,
    });
  });

  it('sin votos no sale nadie, aunque el desempate sea al azar', () => {
    expect(decide({}, 'random')).toEqual({ kind: 'none', tieBreak: null });
  });

  it('empate con "nadie sale": no sale nadie', () => {
    expect(decide({ a: 'vale', b: 'ana' }, 'none')).toEqual({
      kind: 'none',
      tieBreak: null,
    });
  });

  it('empate con re-voto: re-votan sólo los empatados', () => {
    const outcome = decide(
      { a: 'vale', b: 'ana', c: 'vale', d: 'ana', e: 'lucas' },
      'revote',
    );
    expect(outcome.kind).toBe('revote');
    expect(outcome.kind === 'revote' && outcome.candidates.sort()).toEqual([
      'ana',
      'vale',
    ]);
  });

  it('si el re-voto vuelve a empatar, no sale nadie (no hay un tercer voto)', () => {
    expect(decide({ a: 'vale', b: 'ana' }, 'revote', true)).toEqual({
      kind: 'none',
      tieBreak: null,
    });
  });

  it('empate de un jugador con "saltear": no hay a quién re-votar, no sale nadie', () => {
    expect(decide({ a: 'vale', b: SKIP_VOTE }, 'revote')).toEqual({
      kind: 'none',
      tieBreak: null,
    });
  });

  it('desempate al azar: elige entre los empatados', () => {
    const votes = { a: 'ana', b: 'vale' }; // líderes en orden de aparición: ana, vale
    expect(decide(votes, 'random', false, () => 0)).toEqual({
      kind: 'expel',
      playerId: 'ana',
      tieBreak: 'random',
    });
    expect(decide(votes, 'random', false, () => 0.99)).toEqual({
      kind: 'expel',
      playerId: 'vale',
      tieBreak: 'random',
    });
  });

  it('desempate al azar que cae en "saltear": no sale nadie', () => {
    expect(
      decide({ a: SKIP_VOTE, b: 'vale' }, 'random', false, () => 0),
    ).toEqual({ kind: 'none', tieBreak: 'random' });
  });
});
