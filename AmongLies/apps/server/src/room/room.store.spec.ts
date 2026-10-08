import type { Player } from '@amonglies/shared';
import { RoomStore } from './room.store.js';

// uuid sólo se publica como ESM y Jest no lo carga; acá el id da igual.
let nextId = 0;
jest.mock('uuid', () => ({ v4: () => `id-${nextId++}` }));

const player = (id: string, nickname = id): Player => ({
  id,
  nickname,
  avatarId: 'fox',
  locale: 'es',
  isAdmin: false,
  isConnected: true,
  isGuest: true,
});

describe('RoomStore.listPublic', () => {
  let store: RoomStore;
  beforeEach(() => {
    jest.useFakeTimers();
    store = new RoomStore();
  });
  afterEach(() => jest.useRealTimers());

  it('las salas son privadas por defecto y no aparecen', () => {
    store.createRoom(player('a'));
    expect(store.listPublic()).toEqual([]);
  });

  it('muestra las públicas con lo justo (sin chat ni ajustes)', () => {
    const room = store.createRoom(player('a', 'Juan'));
    room.settings.isPrivate = false;
    room.settings.maxPlayers = 6;
    room.selectedGameId = 'drawing';
    store.addPlayer(room.code, player('b'));
    expect(store.listPublic()).toEqual([
      {
        code: room.code,
        playerCount: 2,
        maxPlayers: 6,
        state: 'lobby',
        selectedGameId: 'drawing',
        locale: 'es',
        adminNickname: 'Juan',
        adminAvatarId: 'fox',
        createdAt: room.createdAt,
      },
    ]);
  });

  it('primero las que están en el lobby, después las que juegan; y por cantidad de jugadores', () => {
    const playing = store.createRoom(player('a'));
    const small = store.createRoom(player('b'));
    const big = store.createRoom(player('c'));
    for (const room of [playing, small, big]) room.settings.isPrivate = false;
    store.addPlayer(big.code, player('d'));
    store.setState(playing.code, 'playing');
    expect(store.listPublic().map((r) => r.code)).toEqual([
      big.code,
      small.code,
      playing.code,
    ]);
  });
});
