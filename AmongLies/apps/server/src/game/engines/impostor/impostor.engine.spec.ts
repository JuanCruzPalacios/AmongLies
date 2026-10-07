import type { ImpostorSettings, Player } from '@amonglies/shared';
import type { EngineCallbacks } from '../../engine.js';
import { ImpostorEngine, IMPOSTOR_REGISTRATION } from './impostor.engine.js';

const ADMIN = { isAdmin: true };
const PLAYER = { isAdmin: false };

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `Jugador${i + 1}`,
    avatarId: 'fox',
    locale: 'es',
    isAdmin: i === 0,
    isConnected: true,
  }));
}

function makeSettings(
  overrides: Partial<ImpostorSettings> = {},
): ImpostorSettings {
  return {
    partidas: 1,
    maxRoundsPerPartida: 0,
    impostorCount: 1,
    turnTimeSeconds: 30,
    discussionTimeSeconds: 0,
    votingTimeSeconds: 30,
    wordRevealTimeSeconds: 5,
    selectedWordLists: ['es-animales'],
    communicationMode: 'chat',
    ...overrides,
  };
}

function setup(settings: Partial<ImpostorSettings> = {}, playerCount = 4) {
  const players = makePlayers(playerCount);
  const callbacks: jest.Mocked<EngineCallbacks> = {
    onStateUpdate: jest.fn(),
    onPhaseChange: jest.fn(),
    onRoundStart: jest.fn(),
    onGameEnd: jest.fn(),
  };
  const engine = new ImpostorEngine(players, makeSettings(settings), callbacks);
  engine.start();

  const view = (id: string) => engine.getStateForPlayer(id);
  const impostorIds = players
    .filter((p) => view(p.id).isImpostor)
    .map((p) => p.id);
  const innocentIds = players
    .filter((p) => !impostorIds.includes(p.id))
    .map((p) => p.id);
  const phase = () => view('p1').phase;

  /** Termina la revelación y hace que todos den una pista. */
  const playTurns = () => {
    jest.advanceTimersByTime(5000);
    const order = view('p1').turnOrder;
    order.forEach((id, i) =>
      engine.handleAction(
        id,
        { type: 'submit-word', payload: `pista${i}` },
        PLAYER,
      ),
    );
  };

  /** Todos los activos votan a `targetId` (el votado vota a otro). */
  const everyoneVotes = (targetId: string) => {
    const active = players.filter(
      (p) => !view('p1').eliminatedPlayerIds.includes(p.id),
    );
    for (const p of active) {
      const target =
        p.id === targetId
          ? active.find((o) => o.id !== targetId)!.id
          : targetId;
      engine.handleAction(p.id, { type: 'vote', payload: target }, PLAYER);
    }
  };

  return {
    engine,
    players,
    callbacks,
    view,
    impostorIds,
    innocentIds,
    phase,
    playTurns,
    everyoneVotes,
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('ImpostorEngine — información oculta', () => {
  it('el impostor no recibe la palabra secreta y los inocentes sí', () => {
    const { view, impostorIds, innocentIds } = setup();
    expect(impostorIds).toHaveLength(1);
    expect(view(impostorIds[0]).secretWord).toBeNull();
    for (const id of innocentIds) {
      expect(typeof view(id).secretWord).toBe('string');
      expect(view(id).secretWord).not.toBe('');
    }
  });

  it('los impostores se conocen entre sí y los inocentes no ven a ninguno', () => {
    const { view, impostorIds, innocentIds } = setup({ impostorCount: 2 }, 6);
    expect(impostorIds).toHaveLength(2);
    expect(view(impostorIds[0]).fellowImpostorIds).toEqual([impostorIds[1]]);
    expect(view(innocentIds[0]).fellowImpostorIds).toEqual([]);
  });

  it('los votos individuales se ocultan durante la votación', () => {
    const { engine, view, playTurns, innocentIds } = setup();
    playTurns();
    engine.handleAction(
      'p1',
      { type: 'vote', payload: innocentIds.find((id) => id !== 'p1') ?? 'p2' },
      PLAYER,
    );
    expect(view('p2').votes).toEqual({});
    expect(view('p2').voteCount).toBe(1);
    expect(view('p1').hasVoted).toBe(true);
  });

  it('nunca asigna tantos impostores como inocentes (pide 3 con 4 jugadores → 1)', () => {
    const { impostorIds } = setup({ impostorCount: 3 }, 4);
    expect(impostorIds).toHaveLength(1);
  });
});

describe('ImpostorEngine — flujo de una partida', () => {
  it('avisa el comienzo de cada ronda con partida y número de ronda', () => {
    const { callbacks } = setup();
    expect(callbacks.onRoundStart).toHaveBeenCalledWith({
      partida: 1,
      ronda: 1,
    });
  });

  it('pasa de la revelación a los turnos cuando vence el timer', () => {
    const { phase } = setup({ wordRevealTimeSeconds: 5 });
    expect(phase()).toBe('word-reveal');
    jest.advanceTimersByTime(4999);
    expect(phase()).toBe('word-reveal');
    jest.advanceTimersByTime(1);
    expect(phase()).toBe('turns');
  });

  it('expulsar al único impostor hace ganar a los inocentes y termina el juego', () => {
    const { phase, view, playTurns, everyoneVotes, impostorIds, callbacks } =
      setup();
    playTurns();
    expect(phase()).toBe('voting');

    everyoneVotes(impostorIds[0]);
    expect(phase()).toBe('vote-results');
    expect(view('p1').eliminatedPlayerIds).toEqual(impostorIds);

    jest.advanceTimersByTime(9000);
    expect(phase()).toBe('game-end');
    expect(callbacks.onGameEnd).toHaveBeenCalledTimes(1);
    expect(view('p1').partidaResults).toEqual([
      {
        partida: 1,
        winner: 'players',
        reason: 'impostors-eliminated',
        impostorIds,
      },
    ]);
  });

  it('con empate nadie es expulsado y se juega otra ronda', () => {
    const { engine, phase, view, playTurns, callbacks } = setup();
    playTurns();
    // p2 y p1 reciben 2 votos cada uno: empate en el máximo
    engine.handleAction('p1', { type: 'vote', payload: 'p2' }, PLAYER);
    engine.handleAction('p2', { type: 'vote', payload: 'p1' }, PLAYER);
    engine.handleAction('p3', { type: 'vote', payload: 'p2' }, PLAYER);
    engine.handleAction('p4', { type: 'vote', payload: 'p1' }, PLAYER);
    expect(view('p1').eliminatedPlayerIds).toEqual([]);
    expect(view('p1').results[0].winner).toBe('tie');

    jest.advanceTimersByTime(9000);
    expect(phase()).toBe('word-reveal');
    expect(view('p1').roundWithinPartida).toBe(2);
    expect(callbacks.onRoundStart).toHaveBeenLastCalledWith({
      partida: 1,
      ronda: 2,
    });
  });

  it('al llegar al tope de rondas ganan los impostores', () => {
    const { phase, view, playTurns, everyoneVotes, innocentIds } = setup({
      maxRoundsPerPartida: 1,
    });
    playTurns();
    everyoneVotes(innocentIds[0]);
    jest.advanceTimersByTime(9000);
    expect(phase()).toBe('game-end');
    expect(view('p1').partidaResults[0]).toMatchObject({
      winner: 'impostor',
      reason: 'max-rounds',
    });
  });

  it('sin tope, expulsar a un inocente no termina la partida (1 impostor vs 2 inocentes)', () => {
    const { phase, playTurns, everyoneVotes, innocentIds } = setup();
    playTurns();
    everyoneVotes(innocentIds[0]);
    jest.advanceTimersByTime(9000);
    expect(phase()).toBe('word-reveal');
  });

  it('con varias partidas pasa al resumen de partida y después a la siguiente', () => {
    const { phase, view, playTurns, everyoneVotes, impostorIds } = setup({
      partidas: 2,
    });
    playTurns();
    everyoneVotes(impostorIds[0]);
    jest.advanceTimersByTime(9000);
    expect(phase()).toBe('partida-end');

    jest.advanceTimersByTime(15000);
    expect(phase()).toBe('word-reveal');
    expect(view('p1').partida).toBe(2);
    expect(view('p1').eliminatedPlayerIds).toEqual([]);
  });
});

describe('ImpostorEngine — validaciones', () => {
  it('rechaza que un inocente diga la palabra secreta', () => {
    const { engine, view, innocentIds } = setup();
    jest.advanceTimersByTime(5000);
    let current = view('p1').turnOrder[0];
    if (!innocentIds.includes(current)) {
      // Si arranca el impostor, da su pista y pasa el turno a un inocente.
      engine.handleAction(
        current,
        { type: 'submit-word', payload: 'algo' },
        PLAYER,
      );
      current = view('p1').turnOrder[1];
    }
    const secret = view(current).secretWord!;
    expect(
      engine.handleAction(
        current,
        { type: 'submit-word', payload: secret.toUpperCase() },
        PLAYER,
      ),
    ).toBe('word_is_secret');
  });

  it('rechaza una pista repetida sin importar mayúsculas', () => {
    const { engine, view } = setup();
    jest.advanceTimersByTime(5000);
    const [first, second] = view('p1').turnOrder;
    engine.handleAction(
      first,
      { type: 'submit-word', payload: 'Rojo' },
      PLAYER,
    );
    expect(
      engine.handleAction(
        second,
        { type: 'submit-word', payload: 'rojo' },
        PLAYER,
      ),
    ).toBe('word_already_used');
  });

  it('ignora una pista de quien no tiene el turno', () => {
    const { engine, view } = setup();
    jest.advanceTimersByTime(5000);
    const notCurrent = view('p1').turnOrder[1];
    engine.handleAction(
      notCurrent,
      { type: 'submit-word', payload: 'algo' },
      PLAYER,
    );
    expect(view('p1').wordsUsed).toEqual([]);
  });

  it('ignora una pista que no es texto', () => {
    const { engine, view } = setup();
    jest.advanceTimersByTime(5000);
    const current = view('p1').turnOrder[0];
    expect(
      engine.handleAction(
        current,
        { type: 'submit-word', payload: { x: 1 } },
        PLAYER,
      ),
    ).toBeNull();
    expect(view('p1').wordsUsed).toEqual([]);
  });

  it('ignora votos a uno mismo, a jugadores inexistentes y votos dobles', () => {
    const { engine, view, playTurns } = setup();
    playTurns();
    engine.handleAction('p1', { type: 'vote', payload: 'p1' }, PLAYER);
    engine.handleAction('p1', { type: 'vote', payload: 'fantasma' }, PLAYER);
    engine.handleAction('p1', { type: 'vote', payload: 42 }, PLAYER);
    expect(view('p1').voteCount).toBe(0);

    engine.handleAction('p1', { type: 'vote', payload: 'p2' }, PLAYER);
    engine.handleAction('p1', { type: 'vote', payload: 'p3' }, PLAYER);
    expect(view('p1').voteCount).toBe(1);
  });

  it('un eliminado no puede votar ni chatear', () => {
    const { engine, view, playTurns, everyoneVotes, innocentIds } = setup(
      {},
      5,
    );
    playTurns();
    const eliminated = innocentIds[0];
    everyoneVotes(eliminated);
    expect(engine.canChat(eliminated)).toBe(false);
    expect(engine.canChat(innocentIds[1])).toBe(true);

    jest.advanceTimersByTime(9000); // nueva ronda
    jest.advanceTimersByTime(5000);
    const order = view('p1').turnOrder;
    expect(order).not.toContain(eliminated);
  });
});

describe('ImpostorEngine — modo voz', () => {
  it('sólo el admin puede saltear al que está hablando', () => {
    const { engine, view } = setup({ communicationMode: 'voice' });
    jest.advanceTimersByTime(5000);

    expect(engine.handleAction('p2', { type: 'advance' }, PLAYER)).toBe(
      'not_admin',
    );
    expect(view('p1').currentTurnIndex).toBe(0);

    expect(engine.handleAction('p1', { type: 'advance' }, ADMIN)).toBeNull();
    expect(view('p1').currentTurnIndex).toBe(1);
  });
});

describe('IMPOSTOR_REGISTRATION.validateStart', () => {
  const players = makePlayers(4);

  it('permite empezar con ajustes válidos', () => {
    expect(
      IMPOSTOR_REGISTRATION.validateStart(players, { ...makeSettings() }),
    ).toBeNull();
  });

  it('exige al menos una lista de palabras', () => {
    expect(
      IMPOSTOR_REGISTRATION.validateStart(players, {
        ...makeSettings(),
        selectedWordLists: [],
      }),
    ).toBe('no_word_lists_selected');
  });

  it('rechaza más impostores de los posibles (2 con 4 jugadores)', () => {
    expect(
      IMPOSTOR_REGISTRATION.validateStart(players, {
        ...makeSettings(),
        impostorCount: 2,
      }),
    ).toBe('too_many_impostors');
  });

  it('acepta el máximo exacto (2 con 5 jugadores)', () => {
    expect(
      IMPOSTOR_REGISTRATION.validateStart(makePlayers(5), {
        ...makeSettings(),
        impostorCount: 2,
      }),
    ).toBeNull();
  });
});
