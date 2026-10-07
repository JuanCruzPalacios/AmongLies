import { GAME_IMPOSTOR, getWordListsByLocale } from '@amonglies/shared';
import {
  getDefaultGameSettings,
  sanitizeGameSettings,
  sanitizeWordLists,
} from './settings.js';

const esListIds = getWordListsByLocale('es').map((list) => list.id);

describe('getDefaultGameSettings', () => {
  it('usa los valores por defecto del schema del juego', () => {
    const defaults = getDefaultGameSettings(GAME_IMPOSTOR, 'es');
    expect(defaults.partidas).toBe(3);
    expect(defaults.maxRoundsPerPartida).toBe(0);
    expect(defaults.impostorCount).toBe(1);
    expect(defaults.communicationMode).toBe('chat');
  });

  it('selecciona todas las listas del idioma de la sala', () => {
    expect(
      getDefaultGameSettings(GAME_IMPOSTOR, 'en').selectedWordLists,
    ).toEqual(getWordListsByLocale('en').map((list) => list.id));
  });
});

describe('sanitizeGameSettings', () => {
  const current = getDefaultGameSettings(GAME_IMPOSTOR, 'es');
  const sanitize = (input: unknown) =>
    sanitizeGameSettings(GAME_IMPOSTOR, input, current, 'es');

  it('aplica un valor válido', () => {
    expect(sanitize({ partidas: 5 }).partidas).toBe(5);
  });

  it('acepta los límites exactos del rango', () => {
    expect(sanitize({ partidas: 1 }).partidas).toBe(1);
    expect(sanitize({ partidas: 10 }).partidas).toBe(10);
  });

  it('recorta valores justo afuera del rango', () => {
    expect(sanitize({ partidas: 0 }).partidas).toBe(1);
    expect(sanitize({ partidas: 11 }).partidas).toBe(10);
    expect(sanitize({ impostorCount: -3 }).impostorCount).toBe(1);
  });

  it('redondea decimales donde se espera un entero', () => {
    expect(sanitize({ partidas: 2.6 }).partidas).toBe(3);
  });

  it.each([['3'], [null], [NaN], [Infinity], [true]])(
    'ignora un número inválido: %p',
    (value) => {
      expect(sanitize({ partidas: value }).partidas).toBe(3);
    },
  );

  it('acepta sólo opciones existentes en un select', () => {
    expect(sanitize({ communicationMode: 'voice' }).communicationMode).toBe(
      'voice',
    );
    expect(sanitize({ communicationMode: 'telepatia' }).communicationMode).toBe(
      'chat',
    );
  });

  it('ignora claves que no están en el schema', () => {
    expect(sanitize({ hack: true })).toEqual(current);
  });

  it.each([[null], [undefined], ['texto'], [42], [[1, 2]]])(
    'devuelve los ajustes actuales si el input no es un objeto: %p',
    (input) => {
      expect(sanitize(input)).toBe(current);
    },
  );

  it('no modifica el objeto actual', () => {
    sanitize({ partidas: 7 });
    expect(current.partidas).toBe(3);
  });

  it('no deja la selección de listas vacía', () => {
    expect(sanitize({ selectedWordLists: [] }).selectedWordLists).toEqual(
      esListIds,
    );
  });
});

describe('sanitizeWordLists', () => {
  it('conserva ids válidos del idioma', () => {
    expect(sanitizeWordLists(['es-animales'], 'es')).toEqual(['es-animales']);
  });

  it('descarta listas de otro idioma', () => {
    expect(sanitizeWordLists(['es-animales', 'en-animals'], 'es')).toEqual([
      'es-animales',
    ]);
  });

  it('descarta ids inexistentes, no-strings y repetidos', () => {
    expect(
      sanitizeWordLists(['es-animales', 'nope', 7, null, 'es-animales'], 'es'),
    ).toEqual(['es-animales']);
  });

  it('devuelve vacío si no es un array', () => {
    expect(sanitizeWordLists('es-animales', 'es')).toEqual([]);
  });
});
