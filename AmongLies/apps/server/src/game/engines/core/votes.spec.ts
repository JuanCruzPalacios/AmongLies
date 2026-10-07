import { resolveVotes } from './votes.js';

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
      a: 'vale', b: 'vale', c: 'vale', d: 'ana', e: 'lucas',
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
