import { getPartidaEndReason, maxImpostorsFor } from './rules.js';

describe('maxImpostorsFor', () => {
  it.each([
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 1],
    [4, 1],
    [5, 2],
    [6, 2],
    [7, 3],
  ])('con %i jugadores permite %i impostores', (players, expected) => {
    expect(maxImpostorsFor(players)).toBe(expected);
  });
});

describe('getPartidaEndReason', () => {
  const base = {
    activeImpostors: 1,
    activeInnocents: 3,
    round: 1,
    maxRounds: 0,
  };

  it('sigue la partida si hay más inocentes que impostores y no hay tope', () => {
    expect(getPartidaEndReason(base)).toBeNull();
  });

  it('ganan los inocentes si no quedan impostores', () => {
    expect(getPartidaEndReason({ ...base, activeImpostors: 0 })).toBe(
      'impostors-eliminated',
    );
  });

  it('ganan los impostores con paridad exacta (1 vs 1)', () => {
    expect(getPartidaEndReason({ ...base, activeInnocents: 1 })).toBe('parity');
  });

  it('ganan los impostores si superan a los inocentes', () => {
    expect(
      getPartidaEndReason({ ...base, activeImpostors: 2, activeInnocents: 1 }),
    ).toBe('parity');
  });

  it('con un inocente de más la partida sigue (2 vs 3)', () => {
    expect(
      getPartidaEndReason({ ...base, activeImpostors: 2, activeInnocents: 3 }),
    ).toBeNull();
  });

  it('con tope 0 no hay límite de rondas', () => {
    expect(
      getPartidaEndReason({ ...base, round: 50, maxRounds: 0 }),
    ).toBeNull();
  });

  it('una ronda antes del tope la partida sigue', () => {
    expect(getPartidaEndReason({ ...base, round: 2, maxRounds: 3 })).toBeNull();
  });

  it('al llegar al tope ganan los impostores', () => {
    expect(getPartidaEndReason({ ...base, round: 3, maxRounds: 3 })).toBe(
      'max-rounds',
    );
  });

  it('eliminar al último impostor en la ronda tope cuenta como victoria inocente', () => {
    expect(
      getPartidaEndReason({
        ...base,
        activeImpostors: 0,
        round: 3,
        maxRounds: 3,
      }),
    ).toBe('impostors-eliminated');
  });
});
