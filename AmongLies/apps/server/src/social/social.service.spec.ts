import type { FriendProfile } from '@amonglies/shared';
import {
  RepositoryError,
  type FriendshipRepository,
} from './friendship.repository.js';
import type { FriendshipRow } from './social.rules.js';
import { SocialService } from './social.service.js';

/** Repositorio en memoria con las mismas reglas que la tabla (un vínculo por par). */
class MemoryRepository implements FriendshipRepository {
  rows: FriendshipRow[] = [];
  failing = false;
  constructor(private profiles: FriendProfile[]) {}

  private check() {
    if (this.failing) throw new RepositoryError('caída');
  }
  findByUsername(username: string) {
    this.check();
    return Promise.resolve(
      this.profiles.find(
        (p) => p.username.toLowerCase() === username.toLowerCase(),
      ) ?? null,
    );
  }
  getProfiles(ids: string[]) {
    return Promise.resolve(this.profiles.filter((p) => ids.includes(p.userId)));
  }
  search(prefix: string, exclude: string) {
    this.check();
    return Promise.resolve(
      this.profiles.filter(
        (p) =>
          p.userId !== exclude &&
          p.username.toLowerCase().startsWith(prefix.toLowerCase()),
      ),
    );
  }
  listFor(id: string) {
    this.check();
    return Promise.resolve(
      this.rows.filter((r) => r.requester_id === id || r.addressee_id === id),
    );
  }
  insert(a: string, b: string) {
    const exists = this.rows.some(
      (r) =>
        (r.requester_id === a && r.addressee_id === b) ||
        (r.requester_id === b && r.addressee_id === a),
    );
    if (!exists)
      this.rows.push({ requester_id: a, addressee_id: b, status: 'pending' });
    return Promise.resolve(!exists);
  }
  accept(a: string, b: string) {
    const row = this.rows.find(
      (r) => r.requester_id === a && r.addressee_id === b,
    );
    if (row) row.status = 'accepted';
    return Promise.resolve();
  }
  remove(a: string, b: string) {
    this.rows = this.rows.filter(
      (r) =>
        !(
          (r.requester_id === a && r.addressee_id === b) ||
          (r.requester_id === b && r.addressee_id === a)
        ),
    );
    return Promise.resolve();
  }
}

const profile = (userId: string, username: string): FriendProfile => ({
  userId,
  username,
  avatarId: 'fox',
});
const ANA = profile('ana', 'Ana');
const BETO = profile('beto', 'Beto');
const CARO = profile('caro', 'Caro');
const online = () => ({ status: 'online' as const, roomCode: null });

function setup() {
  const repo = new MemoryRepository([ANA, BETO, CARO]);
  return { repo, social: new SocialService(repo) };
}

describe('SocialService — solicitudes', () => {
  it('manda una solicitud: queda enviada para uno y recibida para el otro', async () => {
    const { social } = setup();
    const result = await social.request('ana', '@beto');
    expect(result).toEqual({ ok: true, target: BETO, accepted: false });
    expect(await social.state('ana', online)).toEqual({
      friends: [],
      incoming: [],
      outgoing: [BETO],
    });
    expect((await social.state('beto', online)).incoming).toEqual([ANA]);
  });

  it('errores: usuario inexistente, uno mismo, repetida, ya amigos', async () => {
    const { social } = setup();
    expect(await social.request('ana', 'nadie')).toEqual({
      ok: false,
      error: 'user_not_found',
    });
    expect(await social.request('ana', 'a b')).toEqual({
      ok: false,
      error: 'user_not_found',
    });
    expect(await social.request('ana', 'ANA')).toEqual({
      ok: false,
      error: 'self',
    });
    await social.request('ana', 'beto');
    expect(await social.request('ana', 'beto')).toEqual({
      ok: false,
      error: 'already_requested',
    });
    await social.respond('beto', 'ana', true);
    expect(await social.request('ana', 'beto')).toEqual({
      ok: false,
      error: 'already_friends',
    });
  });

  it('si los dos se mandan solicitud, quedan amigos', async () => {
    const { social } = setup();
    await social.request('ana', 'beto');
    expect(await social.request('beto', 'ana')).toEqual({
      ok: true,
      target: ANA,
      accepted: true,
    });
    expect(await social.friendIds('ana')).toEqual(['beto']);
  });

  it('aceptar: son amigos los dos, con su presencia', async () => {
    const { social } = setup();
    await social.request('ana', 'beto');
    expect(await social.respond('beto', 'ana', true)).toEqual({
      ok: true,
      accepted: true,
    });
    const state = await social.state('ana', (id) =>
      id === 'beto'
        ? { status: 'lobby', roomCode: 'ABC123' }
        : { status: 'offline', roomCode: null },
    );
    expect(state.friends).toEqual([
      { ...BETO, presence: { status: 'lobby', roomCode: 'ABC123' } },
    ]);
    expect(state.outgoing).toEqual([]);
  });

  it('rechazar borra la solicitud y se puede volver a pedir', async () => {
    const { social } = setup();
    await social.request('ana', 'beto');
    expect(await social.respond('beto', 'ana', false)).toEqual({
      ok: true,
      accepted: false,
    });
    expect((await social.state('ana', online)).outgoing).toEqual([]);
    expect((await social.request('ana', 'beto')).ok).toBe(true);
  });

  it('no se puede responder una solicitud propia ni una inexistente', async () => {
    const { social } = setup();
    await social.request('ana', 'beto');
    expect(await social.respond('ana', 'beto', true)).toEqual({
      ok: false,
      error: 'user_not_found',
    });
    expect(await social.respond('beto', 'caro', true)).toEqual({
      ok: false,
      error: 'user_not_found',
    });
    expect(await social.respond('beto', 42, true)).toEqual({
      ok: false,
      error: 'user_not_found',
    });
  });

  it('"accept" que no es true cuenta como rechazo', async () => {
    const { social } = setup();
    await social.request('ana', 'beto');
    expect(await social.respond('beto', 'ana', 'yes')).toEqual({
      ok: true,
      accepted: false,
    });
  });
});

describe('SocialService — eliminar', () => {
  it('elimina a un amigo de los dos lados', async () => {
    const { social } = setup();
    await social.request('ana', 'beto');
    await social.respond('beto', 'ana', true);
    expect(await social.remove('beto', 'ana')).toEqual({ ok: true });
    expect(await social.friendIds('ana')).toEqual([]);
  });

  it('cancela una solicitud enviada, pero no una recibida', async () => {
    const { social } = setup();
    await social.request('ana', 'beto');
    expect(await social.remove('beto', 'ana')).toEqual({
      ok: false,
      error: 'not_friends',
    });
    expect(await social.remove('ana', 'beto')).toEqual({ ok: true });
    expect((await social.state('beto', online)).incoming).toEqual([]);
  });

  it('sin vínculo no hay nada que eliminar', async () => {
    const { social } = setup();
    expect(await social.remove('ana', 'caro')).toEqual({
      ok: false,
      error: 'not_friends',
    });
  });
});

describe('SocialService — búsqueda y fallas', () => {
  it('busca por prefijo sin incluirse a uno mismo', async () => {
    const { social } = setup();
    expect(await social.search('ana', '@b')).toEqual([BETO]);
    expect(await social.search('ana', 'a')).toEqual([]);
    expect(await social.search('ana', '*')).toEqual([]);
  });

  it('ordena amigos y solicitudes por nombre', async () => {
    const { social } = setup();
    await social.request('caro', 'beto');
    await social.request('ana', 'beto');
    expect(
      (await social.state('beto', online)).incoming.map((p) => p.username),
    ).toEqual(['Ana', 'Caro']);
  });

  it('si la base no responde, devuelve "unavailable" sin romper', async () => {
    const { repo, social } = setup();
    repo.failing = true;
    expect(await social.request('ana', 'beto')).toEqual({
      ok: false,
      error: 'unavailable',
    });
    expect(await social.search('ana', 'b')).toEqual([]);
  });
});
