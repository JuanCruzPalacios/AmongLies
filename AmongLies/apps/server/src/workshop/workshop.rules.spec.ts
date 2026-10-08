import { GAME_DRAWING } from '@amonglies/shared';
import { sanitizeWords, validateDraft } from './workshop.rules.js';

const words = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`);
const list = (overrides: Record<string, unknown> = {}) => ({
  kind: 'word_list',
  title: 'Mi lista',
  locale: 'es',
  category: 'animals',
  words: words(10),
  ...overrides,
});

describe('sanitizeWords', () => {
  it('recorta espacios, saca vacías y repetidas sin importar mayúsculas', () => {
    const result = sanitizeWords([
      '  Gato ',
      'gato',
      'GATO',
      '',
      '   ',
      'Perro   salchicha',
      ...words(8),
    ]);
    expect(result).toEqual({
      ok: true,
      words: ['Gato', 'Perro salchicha', ...words(8)],
    });
  });

  it('mínimo 10 y máximo 300 palabras (después de limpiar)', () => {
    expect(sanitizeWords(words(9))).toEqual({
      ok: false,
      error: 'too_few_words',
    });
    expect(sanitizeWords([...words(9), 'palabra0'])).toEqual({
      ok: false,
      error: 'too_few_words',
    });
    expect(sanitizeWords(words(10)).ok).toBe(true);
    expect(sanitizeWords(words(300)).ok).toBe(true);
    expect(sanitizeWords(words(301))).toEqual({
      ok: false,
      error: 'too_many_words',
    });
  });

  it('una palabra de más de 30 caracteres invalida la lista', () => {
    expect(sanitizeWords([...words(10), 'a'.repeat(30)]).ok).toBe(true);
    expect(sanitizeWords([...words(10), 'a'.repeat(31)])).toEqual({
      ok: false,
      error: 'invalid',
    });
  });

  it('ignora lo que no es texto y rechaza lo que no es lista', () => {
    expect(sanitizeWords([...words(10), 5, null, {}]).ok).toBe(true);
    expect(sanitizeWords('gato, perro')).toEqual({
      ok: false,
      error: 'invalid',
    });
  });
});

describe('validateDraft — listas', () => {
  it('arma los campos de una lista', () => {
    expect(validateDraft(list({ drawable: true }))).toEqual({
      ok: true,
      fields: {
        kind: 'word_list',
        title: 'Mi lista',
        description: '',
        locale: 'es',
        category: 'animals',
        games: ['impostor', 'drawing'],
        drawable: true,
        content: { words: words(10) },
      },
    });
  });

  it('sin marca de dibujable no sirve para el Dibujo', () => {
    const result = validateDraft(list({ drawable: 'yes' }));
    expect(result.ok && result.fields.games).toEqual(['impostor']);
    expect(result.ok && result.fields.drawable).toBe(false);
  });

  it('categoría desconocida pasa a "other"', () => {
    const result = validateDraft(list({ category: 'cosas<script>' }));
    expect(result.ok && result.fields.category).toBe('other');
  });

  it('título de 3 a 40 caracteres, descripción hasta 200', () => {
    expect(validateDraft(list({ title: 'ab' })).ok).toBe(false);
    expect(validateDraft(list({ title: '  ab   ' })).ok).toBe(false);
    expect(validateDraft(list({ title: 'abc' })).ok).toBe(true);
    expect(validateDraft(list({ title: 'a'.repeat(40) })).ok).toBe(true);
    expect(validateDraft(list({ title: 'a'.repeat(41) })).ok).toBe(false);
    expect(validateDraft(list({ description: 'a'.repeat(200) })).ok).toBe(true);
    expect(validateDraft(list({ description: 'a'.repeat(201) })).ok).toBe(
      false,
    );
  });

  it('idioma obligatorio: es o en', () => {
    expect(validateDraft(list({ locale: 'pt' })).ok).toBe(false);
    expect(validateDraft(list({ locale: undefined })).ok).toBe(false);
  });

  it('rechaza tipos desconocidos o algo que no es objeto', () => {
    expect(validateDraft(list({ kind: 'avatar' })).ok).toBe(false);
    expect(validateDraft(null).ok).toBe(false);
    expect(validateDraft('lista').ok).toBe(false);
  });
});

describe('validateDraft — filtro de insultos', () => {
  it('no deja publicar títulos, descripciones ni palabras con insultos', () => {
    const inappropriate = { ok: false, error: 'inappropriate' };
    expect(validateDraft(list({ title: 'Lista de mierda' }))).toEqual(
      inappropriate,
    );
    expect(validateDraft(list({ description: 'para idiotas' }))).toEqual(
      inappropriate,
    );
    expect(validateDraft(list({ words: [...words(10), 'pelotudo'] }))).toEqual(
      inappropriate,
    );
  });

  it('palabras normales que contienen un insulto adentro pasan', () => {
    expect(
      validateDraft(list({ words: [...words(9), 'Computadora'] })).ok,
    ).toBe(true);
  });
});

describe('validateDraft — presets', () => {
  const preset = (overrides: Record<string, unknown> = {}) => ({
    kind: 'preset',
    title: 'Dibujo rápido',
    gameId: 'drawing',
    settings: { inkPerTurn: 50, turnsPerRound: 2 },
    ...overrides,
  });

  it('guarda todos los ajustes del juego (los no enviados, por defecto)', () => {
    const result = validateDraft(preset());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const content = result.fields.content as {
      gameId: string;
      settings: Record<string, unknown>;
    };
    expect(result.fields.games).toEqual(['drawing']);
    expect(result.fields.locale).toBeNull();
    expect(content.gameId).toBe('drawing');
    expect(content.settings.inkPerTurn).toBe(50);
    expect(content.settings.turnsPerRound).toBe(2);
    expect(Object.keys(content.settings).sort()).toEqual(
      GAME_DRAWING.settingsSchema.map((s) => s.key).sort(),
    );
  });

  it('no guarda listas de palabras y recorta valores fuera de rango', () => {
    const result = validateDraft(
      preset({
        settings: {
          selectedWordLists: ['es-animales'],
          inkPerTurn: 99999,
          hack: 1,
        },
      }),
    );
    if (!result.ok) throw new Error('debía ser válido');
    const { settings } = result.fields.content as {
      settings: Record<string, unknown>;
    };
    expect(settings.selectedWordLists).toBeUndefined();
    expect(settings.hack).toBeUndefined();
    expect(settings.inkPerTurn).toBe(1000);
  });

  it('rechaza un juego inexistente', () => {
    expect(validateDraft(preset({ gameId: 'ajedrez' })).ok).toBe(false);
    expect(validateDraft(preset({ gameId: undefined })).ok).toBe(false);
  });
});
