import type { Player, TimePlayerView, TimeSettings } from '@amonglies/shared';
import { GAME_TIME } from '@amonglies/shared';
import type { EngineCallbacks } from '../../engine.js';
import { getDefaultGameSettings } from '../../settings.js';
import { TimeEngine, TIME_REGISTRATION } from './time.engine.js';

const PLAYER = { isAdmin: false };

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

function makeSettings(overrides: Partial<TimeSettings> = {}): TimeSettings {
  return {
    partidas: 1,
    maxRoundsPerPartida: 0,
    impostorCount: 1,
    discussionTimeSeconds: 0,
    votingTimeSeconds: 30,
    secretVote: false,
    allowSkipVote: true,
    tieBreak: 'none',
    targetMinSeconds: 5,
    targetMaxSeconds: 20,
    maxTurnSeconds: 30,
    roleRevealTimeSeconds: 5,
    ...overrides,
  };
}

function setup(settings: Partial<TimeSettings> = {}, playerCount = 4) {
  const callbacks: jest.Mocked<EngineCallbacks> = {
    onStateUpdate: jest.fn(),
    onPhaseChange: jest.fn(),
    onRoundStart: jest.fn(),
    onGameEnd: jest.fn(),
  };
  const engine = new TimeEngine(
    makePlayers(playerCount),
    makeSettings(settings),
    callbacks,
  );
  engine.start();
  const view = (id: string) => engine.getStateForPlayer(id) as TimePlayerView;
  const ids = makePlayers(playerCount).map((p) => p.id);
  const impostorId = ids.find((id) => view(id).isImpostor)!;
  const innocentId = ids.find((id) => !view(id).isImpostor)!;
  const current = () => view('p1').turnOrder[view('p1').currentTurnIndex];
  const toTurns = () => jest.advanceTimersByTime(5000);
  /** El jugador de turno arranca y para su reloj a los `ms`. */
  const play = (ms: number, reported = ms) => {
    const id = current();
    engine.handleAction(id, { type: 'start-clock' }, PLAYER);
    jest.advanceTimersByTime(ms);
    engine.handleAction(
      id,
      { type: 'stop-clock', payload: { elapsedMs: reported } },
      PLAYER,
    );
    return id;
  };
  return { engine, view, impostorId, innocentId, current, toTurns, play };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('TimeEngine — información oculta', () => {
  it('sólo los inocentes ven el tiempo objetivo', () => {
    const { view, impostorId, innocentId } = setup();
    expect(view(impostorId).targetMs).toBeNull();
    const target = view(innocentId).targetMs!;
    expect(target).toBeGreaterThanOrEqual(5000);
    expect(target).toBeLessThanOrEqual(20000);
    expect(target % 100).toBe(0);
  });

  it('el objetivo no aparece en ningún resultado durante la ronda', () => {
    const { view, impostorId, innocentId, toTurns, play } = setup();
    toTurns();
    play(3000);
    expect(view(impostorId).results).toEqual([]);
    expect(JSON.stringify(view(impostorId))).not.toContain(
      '"targetMs":' + view(innocentId).targetMs,
    );
  });
});

describe('TimeEngine — turnos con reloj', () => {
  it('pasa de ver el rol a los turnos cuando vence el timer', () => {
    const { view } = setup();
    expect(view('p1').phase).toBe('role-reveal');
    jest.advanceTimersByTime(5000);
    expect(view('p1').phase).toBe('turns');
  });

  it('el tiempo de cada uno se revela a todos apenas para', () => {
    const { view, toTurns, play } = setup();
    toTurns();
    const first = play(7300);
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      expect(view(id).times).toEqual([
        { playerId: first, ms: 7300, timedOut: false },
      ]);
    }
  });

  it('mientras corre, todos ven que el reloj está en marcha', () => {
    const { engine, view, toTurns, current } = setup();
    toTurns();
    expect(view('p1').clockRunning).toBe(false);
    engine.handleAction(current(), { type: 'start-clock' }, PLAYER);
    expect(view('p2').clockRunning).toBe(true);
  });

  it('el estado que se emite al pasar de turno ya tiene el reloj frenado', () => {
    const { engine, view, toTurns, play } = setup();
    toTurns();
    const emitted: boolean[] = [];
    (engine['callbacks'].onStateUpdate as jest.Mock).mockImplementation(() =>
      emitted.push(view('p1').clockRunning),
    );
    play(1000);
    expect(emitted.at(-1)).toBe(false);
  });

  it('sólo el jugador de turno puede arrancar y parar su reloj', () => {
    const { engine, view, toTurns, current } = setup();
    toTurns();
    const other = view('p1').turnOrder[1];
    engine.handleAction(other, { type: 'start-clock' }, PLAYER);
    expect(view('p1').clockRunning).toBe(false);

    engine.handleAction(current(), { type: 'start-clock' }, PLAYER);
    engine.handleAction(
      other,
      { type: 'stop-clock', payload: { elapsedMs: 1000 } },
      PLAYER,
    );
    expect(view('p1').times).toEqual([]);
  });

  it('parar sin haber arrancado no hace nada', () => {
    const { engine, view, toTurns, current } = setup();
    toTurns();
    engine.handleAction(
      current(),
      { type: 'stop-clock', payload: { elapsedMs: 5000 } },
      PLAYER,
    );
    expect(view('p1').times).toEqual([]);
  });

  it('no se puede informar más tiempo del que pasó en el servidor', () => {
    const { view, toTurns, play } = setup();
    toTurns();
    play(4000, 15000);
    expect(view('p1').times[0].ms).toBe(4000);
  });

  it('se acepta la medición más precisa del cliente si es menor', () => {
    const { view, toTurns, play } = setup();
    toTurns();
    play(4000, 3950);
    expect(view('p1').times[0].ms).toBe(3950);
  });

  it('si no arranca el reloj a tiempo, queda como "se le pasó" y sigue el próximo', () => {
    const { view, toTurns, current } = setup({ maxTurnSeconds: 10 });
    toTurns();
    const first = current();
    jest.advanceTimersByTime(10000);
    expect(view('p1').times).toEqual([
      { playerId: first, ms: 10000, timedOut: true },
    ]);
    expect(current()).toBe(view('p1').turnOrder[1]);
  });

  it('si deja el reloj corriendo, se frena solo en el máximo', () => {
    const { engine, view, toTurns, current } = setup({ maxTurnSeconds: 10 });
    toTurns();
    const first = current();
    jest.advanceTimersByTime(8000); // casi se le pasa el tiempo para arrancar
    engine.handleAction(first, { type: 'start-clock' }, PLAYER);
    jest.advanceTimersByTime(9999);
    expect(view('p1').times).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(view('p1').times).toEqual([
      { playerId: first, ms: 10000, timedOut: true },
    ]);
  });

  it('cuando juegan todos pasa a la votación y el resultado guarda objetivo y tiempos', () => {
    const { engine, view, toTurns, play, innocentId } = setup();
    toTurns();
    const target = view(innocentId).targetMs!;
    play(1000);
    play(2000);
    play(3000);
    play(4000);
    expect(view('p1').phase).toBe('voting');
    for (const voter of ['p1', 'p2', 'p3', 'p4']) {
      engine.handleAction(voter, { type: 'vote', payload: 'skip' }, PLAYER);
    }
    const result = view('p1').results[0];
    expect(result.targetMs).toBe(target);
    expect(result.times.map((t) => t.ms)).toEqual([1000, 2000, 3000, 4000]);
  });

  it('si se pausa con el reloj corriendo, al reanudar el turno vuelve a empezar', () => {
    const { engine, view, toTurns, current } = setup({ maxTurnSeconds: 10 });
    toTurns();
    engine.handleAction(current(), { type: 'start-clock' }, PLAYER);
    jest.advanceTimersByTime(3000);
    engine.pause();
    jest.advanceTimersByTime(60000);
    engine.resume();
    expect(view('p1').clockRunning).toBe(false);
    expect(view('p1').times).toEqual([]);
    // Vuelve a tener el tiempo completo para arrancar.
    jest.advanceTimersByTime(9999);
    expect(view('p1').times).toEqual([]);
  });
});

describe('TimeEngine — registro y ajustes', () => {
  it('los ajustes por defecto no incluyen listas de palabras', () => {
    const defaults = getDefaultGameSettings(GAME_TIME, 'es');
    expect(defaults.selectedWordLists).toBeUndefined();
    expect(defaults.targetMinSeconds).toBe(5);
    expect(defaults.targetMaxSeconds).toBe(20);
  });

  it('valida la cantidad de impostores como el Impostor clásico', () => {
    expect(
      TIME_REGISTRATION.validateStart(makePlayers(4), {
        ...makeSettings(),
        impostorCount: 2,
      }),
    ).toBe('too_many_impostors');
    expect(
      TIME_REGISTRATION.validateStart(makePlayers(4), { ...makeSettings() }),
    ).toBeNull();
  });
});
