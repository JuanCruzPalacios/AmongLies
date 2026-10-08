import type {
  DrawingPlayerView,
  DrawingSettings,
  Player,
} from '@amonglies/shared';
import { DRAWING_COLORS, DRAWING_SIZES } from '@amonglies/shared';
import type { EngineCallbacks } from '../../engine.js';
import { DrawingEngine, DRAWING_REGISTRATION } from './drawing.engine.js';

const PLAYER = { isAdmin: false };
const COLOR = DRAWING_COLORS[1];
const SIZE = DRAWING_SIZES[0];

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `Jugador${i + 1}`,
    avatarId: 'fox',
    locale: 'es',
    isAdmin: i === 0,
    isConnected: true,
    isGuest: true,
  }));
}

function makeSettings(
  overrides: Partial<DrawingSettings> = {},
): DrawingSettings {
  return {
    partidas: 2,
    maxRoundsPerPartida: 0,
    impostorCount: 1,
    discussionTimeSeconds: 0,
    votingTimeSeconds: 30,
    secretVote: false,
    allowSkipVote: true,
    tieBreak: 'none',
    wordRevealTimeSeconds: 5,
    selectedWordLists: ['es-animales'],
    impostorCategoryHint: false,
    turnsPerRound: 1,
    inkPerTurn: 100,
    minInkPercent: 20,
    turnTimeSeconds: 30,
    colorMode: 'free',
    ...overrides,
  };
}

function setup(settings: Partial<DrawingSettings> = {}) {
  const callbacks: jest.Mocked<EngineCallbacks> = {
    onStateUpdate: jest.fn(),
    onPhaseChange: jest.fn(),
    onRoundStart: jest.fn(),
    onGameEnd: jest.fn(),
    onDraw: jest.fn(),
  };
  const engine = new DrawingEngine(
    makePlayers(4),
    makeSettings(settings),
    callbacks,
  );
  engine.start();
  const view = (id: string) =>
    engine.getStateForPlayer(id) as DrawingPlayerView;
  const ids = ['p1', 'p2', 'p3', 'p4'];
  const impostorId = ids.find((id) => view(id).isImpostor)!;
  const innocentId = ids.find((id) => !view(id).isImpostor)!;
  const current = () => view('p1').turnOrder[view('p1').currentTurnIndex];
  const act = (id: string, type: string, payload?: unknown) =>
    engine.handleAction(id, { type, payload }, PLAYER);
  const toTurns = () => jest.advanceTimersByTime(5000);
  /** El jugador de turno traza una línea horizontal de `length` anchos y termina. */
  const draw = (length: number, end = true) => {
    const id = current();
    act(id, 'stroke-start', { x: 0, y: 0.5, color: COLOR, size: SIZE });
    act(id, 'stroke-points', { points: [length, 0.5] });
    if (end) act(id, 'end-turn');
    return id;
  };
  /** Todos votan "saltear": nadie sale y, sin tope, sigue otra ronda. */
  const skipVotes = () => {
    for (const id of ids) act(id, 'vote', 'skip');
    jest.advanceTimersByTime(9000);
  };
  return {
    engine,
    callbacks,
    view,
    impostorId,
    innocentId,
    current,
    act,
    toTurns,
    draw,
    skipVotes,
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('DrawingEngine — información oculta', () => {
  it('el impostor no recibe la palabra; los inocentes sí', () => {
    const { view, impostorId, innocentId } = setup();
    expect(view(impostorId).secretWord).toBeNull();
    expect(view(impostorId).category).toBeNull();
    expect(view(innocentId).secretWord).toEqual(expect.any(String));
    expect(view(innocentId).category).toBe('Animales');
  });

  it('con la pista activada el impostor ve la categoría', () => {
    const { view, impostorId } = setup({ impostorCategoryHint: true });
    expect(view(impostorId).category).toBe('Animales');
    expect(view(impostorId).secretWord).toBeNull();
  });

  it('la palabra no aparece en los resultados hasta que termina la partida', () => {
    const { view, impostorId, toTurns, draw, skipVotes } = setup();
    toTurns();
    for (let i = 0; i < 4; i++) draw(0.5);
    skipVotes();
    expect(view(impostorId).results[0].word).toBe('');
  });
});

describe('DrawingEngine — un lienzo por partida', () => {
  it('la ronda siguiente sigue sobre el mismo dibujo y la misma palabra, sin volver a mostrarla', () => {
    const { view, innocentId, toTurns, draw, skipVotes } = setup();
    const word = view(innocentId).secretWord;
    toTurns();
    for (let i = 0; i < 4; i++) draw(0.5);
    skipVotes();
    expect(view('p1').roundWithinPartida).toBe(2);
    expect(view('p1').phase).toBe('turns');
    expect(view('p1').strokes).toHaveLength(4);
    expect(view(innocentId).secretWord).toBe(word);
  });

  it('una partida nueva empieza con el lienzo vacío', () => {
    const { engine, view, impostorId, toTurns, draw, act } = setup();
    toTurns();
    for (let i = 0; i < 4; i++) draw(0.5);
    // Echan al impostor: termina la partida 1.
    for (const id of ['p1', 'p2', 'p3', 'p4'])
      act(
        id,
        'vote',
        id === impostorId ? (impostorId === 'p1' ? 'p2' : 'p1') : impostorId,
      );
    jest.advanceTimersByTime(9000);
    expect(view('p1').phase).toBe('partida-end');
    expect(view('p1').results[0].word).not.toBe('');
    for (const id of ['p1', 'p2', 'p3', 'p4']) act(id, 'skip-partida-end');
    expect(view('p1').partida).toBe(2);
    expect(view('p1').phase).toBe('word-reveal');
    expect(view('p1').strokes).toEqual([]);
    engine.destroy();
  });
});

describe('DrawingEngine — turnos y tinta', () => {
  it('sólo dibuja el jugador de turno', () => {
    const { view, act, toTurns, current } = setup();
    toTurns();
    const other = view('p1').turnOrder[1];
    act(other, 'stroke-start', { x: 0.1, y: 0.1, color: COLOR, size: SIZE });
    expect(view('p1').strokes).toEqual([]);
    act(current(), 'stroke-start', {
      x: 0.1,
      y: 0.1,
      color: COLOR,
      size: SIZE,
    });
    expect(view('p1').strokes).toHaveLength(1);
  });

  it('no se puede dibujar durante la palabra secreta', () => {
    const { view, act } = setup();
    act(view('p1').turnOrder[0], 'stroke-start', {
      x: 0.1,
      y: 0.1,
      color: COLOR,
      size: SIZE,
    });
    expect(view('p1').strokes).toEqual([]);
  });

  it('rechaza colores y grosores que no son de la paleta', () => {
    const { view, act, toTurns, current } = setup();
    toTurns();
    act(current(), 'stroke-start', {
      x: 0.1,
      y: 0.1,
      color: '#123456',
      size: SIZE,
    });
    act(current(), 'stroke-start', { x: 0.1, y: 0.1, color: COLOR, size: 0.5 });
    act(current(), 'stroke-start', {
      x: '0.1',
      y: 0.1,
      color: COLOR,
      size: SIZE,
    });
    act(current(), 'stroke-start', undefined);
    expect(view('p1').strokes).toEqual([]);
  });

  it('con color por jugador se usa el suyo, elija lo que elija', () => {
    const { view, act, toTurns, current } = setup({ colorMode: 'per-player' });
    toTurns();
    const id = current();
    act(id, 'stroke-start', { x: 0.1, y: 0.1, color: COLOR, size: SIZE });
    expect(view('p1').strokes[0].color).toBe(view('p1').playerColors![id]);
    expect(new Set(Object.values(view('p1').playerColors!)).size).toBe(4);
  });

  it('la tinta se corta en el presupuesto y, al acabarse, pasa el turno', () => {
    const { view, act, toTurns, current } = setup({ inkPerTurn: 50 });
    toTurns();
    const first = current();
    act(first, 'stroke-start', { x: 0, y: 0.5, color: COLOR, size: SIZE });
    act(first, 'stroke-points', { points: [1, 0.5] });
    expect(view('p1').strokes[0].points).toEqual([0, 0.5, 0.5, 0.5]);
    expect(current()).not.toBe(first);
    expect(view('p1').inkUsed).toBe(0);
  });

  it('la tinta se suma entre trazos del mismo turno', () => {
    const { view, act, toTurns, current } = setup({ inkPerTurn: 100 });
    toTurns();
    const id = current();
    act(id, 'stroke-start', { x: 0, y: 0.2, color: COLOR, size: SIZE });
    act(id, 'stroke-points', { points: [0.6, 0.2] });
    act(id, 'stroke-start', { x: 0, y: 0.8, color: COLOR, size: SIZE });
    act(id, 'stroke-points', { points: [0.6, 0.8] });
    expect(view('p1').strokes[1].points).toEqual([0, 0.8, 0.4, 0.8]);
    expect(current()).not.toBe(id);
  });

  it('no deja terminar el turno sin la tinta mínima', () => {
    const { act, toTurns, current, draw } = setup({ minInkPercent: 50 });
    toTurns();
    const id = draw(0.3, false);
    expect(act(id, 'end-turn')).toBe('not_enough_ink');
    expect(current()).toBe(id);
    act(id, 'stroke-points', { points: [0.5, 0.5] });
    expect(act(id, 'end-turn')).toBeNull();
    expect(current()).not.toBe(id);
  });

  it('con tinta mínima 0 se puede pasar sin dibujar', () => {
    const { act, toTurns, current } = setup({ minInkPercent: 0 });
    toTurns();
    const id = current();
    expect(act(id, 'end-turn')).toBeNull();
    expect(current()).not.toBe(id);
  });

  it('el timer de seguridad corta el turno', () => {
    const { toTurns, current } = setup({ turnTimeSeconds: 10 });
    toTurns();
    const id = current();
    jest.advanceTimersByTime(9999);
    expect(current()).toBe(id);
    jest.advanceTimersByTime(1);
    expect(current()).not.toBe(id);
  });

  it('puntos sin trazo empezado o mal formados se ignoran', () => {
    const { view, act, toTurns, current } = setup();
    toTurns();
    act(current(), 'stroke-points', { points: [0.5, 0.5] });
    expect(view('p1').strokes).toEqual([]);
    act(current(), 'stroke-start', { x: 0, y: 0, color: COLOR, size: SIZE });
    act(current(), 'stroke-points', { points: [0.5] });
    act(current(), 'stroke-points', 'x');
    expect(view('p1').strokes[0].points).toEqual([0, 0]);
  });

  it('se transmiten en vivo el inicio del trazo y los puntos aceptados', () => {
    const { callbacks, act, toTurns, current } = setup();
    toTurns();
    const id = current();
    act(id, 'stroke-start', { x: 0, y: 0.5, color: COLOR, size: SIZE });
    act(id, 'stroke-points', { points: [0.3, 0.5] });
    expect(callbacks.onDraw).toHaveBeenNthCalledWith(1, {
      kind: 'start',
      stroke: { playerId: id, color: COLOR, size: SIZE, points: [0, 0.5] },
    });
    expect(callbacks.onDraw).toHaveBeenNthCalledWith(2, {
      kind: 'points',
      points: [0.3, 0.5],
    });
  });

  it('con 2 vueltas por ronda cada uno dibuja dos veces antes de votar', () => {
    const { view, toTurns, draw } = setup({ turnsPerRound: 2 });
    toTurns();
    const order = view('p1').turnOrder;
    const drawers: string[] = [];
    for (let i = 0; i < 8; i++) {
      expect(view('p1').phase).toBe('turns');
      expect(view('p1').lap).toBe(i < 4 ? 1 : 2);
      drawers.push(draw(0.5));
    }
    expect(drawers).toEqual([...order, ...order]);
    expect(view('p1').phase).toBe('voting');
  });

  it('si se va el que está dibujando, sigue el próximo', () => {
    const { engine, view, toTurns, current } = setup({ minInkPercent: 0 });
    toTurns();
    const order = [...view('p1').turnOrder];
    // Se va un inocente que está dibujando (si el primero es el impostor, termina la partida).
    const leaving = order.find((id) => !view(id).isImpostor)!;
    while (current() !== leaving) {
      engine.handleAction(current(), { type: 'end-turn' }, PLAYER);
    }
    engine.removePlayer(leaving);
    expect(current()).toBe(order[order.indexOf(leaving) + 1] ?? undefined);
  });
});

describe('DrawingEngine — inicio', () => {
  it('no arranca sin listas dibujables', () => {
    expect(
      DRAWING_REGISTRATION.validateStart(makePlayers(4), {
        ...makeSettings(),
        selectedWordLists: ['es-paises'],
      }),
    ).toBe('no_word_lists_selected');
    expect(
      DRAWING_REGISTRATION.validateStart(makePlayers(4), { ...makeSettings() }),
    ).toBeNull();
  });

  it('valida la cantidad de impostores', () => {
    expect(
      DRAWING_REGISTRATION.validateStart(makePlayers(4), {
        ...makeSettings(),
        impostorCount: 2,
      }),
    ).toBe('too_many_impostors');
  });
});
