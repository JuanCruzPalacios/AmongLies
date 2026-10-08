import { mergePoints, partidaBonus, roundPoints } from './scoring.js';

describe('roundPoints', () => {
  const impostorIds = ['imp'];

  it('+2 a cada inocente que votó al impostor y +2 al impostor que sobrevive', () => {
    expect(
      roundPoints({
        votes: { a: 'imp', b: 'imp', c: 'b', imp: 'a' },
        impostorIds,
        activeImpostorIds: ['imp'],
        votedOutId: null,
      }),
    ).toEqual({ a: 2, b: 2, imp: 2 });
  });

  it('el impostor expulsado no suma por sobrevivir', () => {
    expect(
      roundPoints({
        votes: { a: 'imp', b: 'imp' },
        impostorIds,
        activeImpostorIds: ['imp'],
        votedOutId: 'imp',
      }),
    ).toEqual({ a: 2, b: 2 });
  });

  it('un impostor que vota a su cómplice no suma por "acertar"', () => {
    expect(
      roundPoints({
        votes: { imp: 'imp2' },
        impostorIds: ['imp', 'imp2'],
        activeImpostorIds: [],
        votedOutId: null,
      }),
    ).toEqual({});
  });

  it('un impostor ya eliminado en rondas anteriores no suma por sobrevivir', () => {
    expect(
      roundPoints({
        votes: {},
        impostorIds: ['imp', 'imp2'],
        activeImpostorIds: ['imp2'],
        votedOutId: null,
      }),
    ).toEqual({ imp2: 2 });
  });

  it('votar "saltear" o a un inocente no suma', () => {
    expect(
      roundPoints({
        votes: { a: 'skip', b: 'c' },
        impostorIds,
        activeImpostorIds: [],
        votedOutId: 'c',
      }),
    ).toEqual({});
  });
});

describe('partidaBonus', () => {
  const playerIds = ['a', 'b', 'imp'];

  it('si ganan los inocentes, +1 a cada inocente (también a los eliminados)', () => {
    expect(
      partidaBonus({ winner: 'players', impostorIds: ['imp'], playerIds }),
    ).toEqual({ a: 1, b: 1 });
  });

  it('si ganan los impostores, +3 a cada impostor', () => {
    expect(
      partidaBonus({ winner: 'impostor', impostorIds: ['imp'], playerIds }),
    ).toEqual({ imp: 3 });
  });

  it('sin jugadores no hay bonus', () => {
    expect(
      partidaBonus({ winner: 'players', impostorIds: [], playerIds: [] }),
    ).toEqual({});
  });
});

describe('mergePoints', () => {
  it('suma sobre lo que ya había y agrega jugadores nuevos', () => {
    const total = { a: 3 };
    expect(mergePoints(total, { a: 2, b: 1 })).toEqual({ a: 5, b: 1 });
    expect(total).toEqual({ a: 5, b: 1 });
  });
});
