import { resolveVotes } from './votes.js';

// Requerimiento: el jugador con más votos es expulsado.
describe('resolveVotes', () => {
  it('expulsa al jugador con más votos', () => {
    const result = resolveVotes({ ana: 'vale', lucas: 'vale', vale: 'ana' });
    expect(result.votedOutId).toBe('vale');
  });
});
