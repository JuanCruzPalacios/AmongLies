import type { Player, Room } from '@amonglies/shared';
import { getDecider } from '@amonglies/shared';

const player = (id: string, isConnected = true): Player => ({
  id,
  nickname: id,
  avatarId: 'fox',
  locale: 'es',
  isAdmin: id === 'admin',
  isConnected,
  isGuest: true,
});

const room = (players: Player[]): Room =>
  ({ adminId: 'admin', players }) as unknown as Room;

describe('getDecider', () => {
  it('decide el admin si está conectado', () => {
    expect(getDecider(room([player('a'), player('admin')]))?.id).toBe('admin');
  });

  it('si el admin se desconectó, decide el conectado más antiguo', () => {
    expect(
      getDecider(
        room([player('admin', false), player('viejo'), player('nuevo')]),
      )?.id,
    ).toBe('viejo');
  });

  it('saltea a los que también están desconectados', () => {
    expect(
      getDecider(
        room([player('admin', false), player('viejo', false), player('nuevo')]),
      )?.id,
    ).toBe('nuevo');
  });

  it('si no hay nadie conectado no decide nadie', () => {
    expect(
      getDecider(room([player('admin', false), player('b', false)])),
    ).toBeUndefined();
  });
});
