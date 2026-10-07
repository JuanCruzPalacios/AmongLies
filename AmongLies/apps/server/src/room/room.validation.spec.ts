import { DEFAULT_ROOM_SETTINGS } from '@amonglies/shared';
import { parseIdentity, sanitizeRoomSettings } from './room.validation.js';

describe('parseIdentity', () => {
  const valid = { nickname: 'Juan', avatarId: 'fox', locale: 'es' };

  it('acepta una identidad válida', () => {
    expect(parseIdentity(valid)).toEqual(valid);
  });

  it('recorta espacios del apodo', () => {
    expect(parseIdentity({ ...valid, nickname: '  Juan  ' })?.nickname).toBe(
      'Juan',
    );
  });

  it('acepta los largos límite (2 y 16)', () => {
    expect(parseIdentity({ ...valid, nickname: 'Jo' })?.nickname).toBe('Jo');
    expect(
      parseIdentity({ ...valid, nickname: 'x'.repeat(16) })?.nickname,
    ).toHaveLength(16);
  });

  it('rechaza largos justo afuera del límite (1 y 17)', () => {
    expect(parseIdentity({ ...valid, nickname: 'J' })).toBeNull();
    expect(parseIdentity({ ...valid, nickname: 'x'.repeat(17) })).toBeNull();
  });

  it('rechaza un apodo de sólo espacios', () => {
    expect(parseIdentity({ ...valid, nickname: '     ' })).toBeNull();
  });

  it('acepta acentos y emojis en el apodo', () => {
    expect(parseIdentity({ ...valid, nickname: 'Ñandú 🦊' })?.nickname).toBe(
      'Ñandú 🦊',
    );
  });

  it('rechaza un apodo que no es texto', () => {
    expect(parseIdentity({ ...valid, nickname: 12345 })).toBeNull();
  });

  it('rechaza un avatar inexistente', () => {
    expect(
      parseIdentity({ ...valid, avatarId: 'unicornio-dorado' }),
    ).toBeNull();
  });

  it('usa español si el idioma no es soportado', () => {
    expect(parseIdentity({ ...valid, locale: 'pt' })?.locale).toBe('es');
  });

  it.each([[null], [undefined], ['Juan']])(
    'rechaza un payload que no es objeto: %p',
    (data) => {
      expect(parseIdentity(data)).toBeNull();
    },
  );
});

describe('sanitizeRoomSettings', () => {
  const current = DEFAULT_ROOM_SETTINGS;

  it('aplica valores válidos', () => {
    expect(
      sanitizeRoomSettings(
        { maxPlayers: 8, isPrivate: false, locale: 'en' },
        current,
      ),
    ).toEqual({ maxPlayers: 8, isPrivate: false, locale: 'en' });
  });

  it('recorta el cupo al rango 0–100', () => {
    expect(sanitizeRoomSettings({ maxPlayers: -1 }, current).maxPlayers).toBe(
      0,
    );
    expect(sanitizeRoomSettings({ maxPlayers: 101 }, current).maxPlayers).toBe(
      100,
    );
  });

  it('ignora un cupo decimal o de otro tipo', () => {
    expect(sanitizeRoomSettings({ maxPlayers: 4.5 }, current).maxPlayers).toBe(
      0,
    );
    expect(sanitizeRoomSettings({ maxPlayers: '8' }, current).maxPlayers).toBe(
      0,
    );
  });

  it('ignora un idioma no soportado y claves extra', () => {
    expect(
      sanitizeRoomSettings({ locale: 'pt', admin: 'yo' }, current),
    ).toEqual(current);
  });
});
