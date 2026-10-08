import type {
  ImpostorPlayerView,
  ImpostorSettings,
  Player,
} from '@amonglies/shared';
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
    isGuest: true,
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
    secretVote: false,
    allowSkipVote: true,
    tieBreak: 'none',
    impostorCategoryHint: false,
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

  const view = (id: string) =>
    engine.getStateForPlayer(id) as ImpostorPlayerView;
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
    const {
      phase,
      view,
      playTurns,
      everyoneVotes,
      impostorIds,
      innocentIds,
      callbacks,
    } = setup();
    playTurns();
    expect(phase()).toBe('voting');

    everyoneVotes(impostorIds[0]);
    expect(phase()).toBe('vote-results');
    expect(view('p1').eliminatedPlayerIds).toEqual(impostorIds);

    jest.advanceTimersByTime(9000);
    expect(phase()).toBe('game-end');
    expect(callbacks.onGameEnd).toHaveBeenCalledTimes(1);
    const points = Object.fromEntries(innocentIds.map((id) => [id, 3]));
    expect(view('p1').partidaResults).toEqual([
      {
        partida: 1,
        winner: 'players',
        reason: 'impostors-eliminated',
        impostorIds,
        points,
      },
    ]);
    expect(view('p1').scores).toEqual(points);
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

describe('ImpostorEngine — pausa y salida de jugadores', () => {
  it('en pausa los timers no avanzan y las acciones se rechazan', () => {
    const { engine, phase, view } = setup({ wordRevealTimeSeconds: 5 });
    jest.advanceTimersByTime(3000);
    engine.pause();
    expect(view('p1').paused).toBe(true);
    jest.advanceTimersByTime(60_000);
    expect(phase()).toBe('word-reveal');
    expect(
      engine.handleAction('p1', { type: 'vote', payload: 'p2' }, PLAYER),
    ).toBe('game_paused');

    engine.resume();
    expect(view('p1').paused).toBe(false);
    jest.advanceTimersByTime(1999);
    expect(phase()).toBe('word-reveal');
    jest.advanceTimersByTime(1);
    expect(phase()).toBe('turns');
  });

  it('si se va el que tiene el turno, el turno pasa al siguiente', () => {
    const { engine, view } = setup({ impostorCount: 2 }, 6);
    jest.advanceTimersByTime(5000);
    // Con 2 impostores entre 6, saque a quien saque la partida sigue.
    const [first, second] = view('p1').turnOrder;
    const observer = view('p1').turnOrder.find((id) => id !== first)!;
    engine.removePlayer(first);
    expect(view(observer).turnOrder).not.toContain(first);
    expect(view(observer).turnOrder[view(observer).currentTurnIndex]).toBe(
      second,
    );
  });

  it('si se va alguien que ya jugó, el turno actual no cambia', () => {
    const { engine, view } = setup({ impostorCount: 2 }, 6);
    jest.advanceTimersByTime(5000);
    const [first, second] = view('p1').turnOrder;
    engine.handleAction(
      first,
      { type: 'submit-word', payload: 'algo' },
      PLAYER,
    );
    engine.removePlayer(first);
    const observer = view('p1').turnOrder.find((id) => id !== first)!;
    expect(view(observer).turnOrder[view(observer).currentTurnIndex]).toBe(
      second,
    );
  });

  it('si se va el último impostor, la partida termina y ganan los inocentes', () => {
    const { engine, phase, view, impostorIds, innocentIds } = setup();
    jest.advanceTimersByTime(5000);
    engine.removePlayer(impostorIds[0]);
    expect(phase()).toBe('game-end');
    expect(view(innocentIds[0]).partidaResults[0]).toMatchObject({
      winner: 'players',
      reason: 'impostors-eliminated',
    });
  });

  it('si al irse un inocente queda paridad, ganan los impostores', () => {
    const { engine, view, innocentIds, impostorIds } = setup({}, 4);
    jest.advanceTimersByTime(5000);
    engine.removePlayer(innocentIds[0]); // 1 impostor vs 2 inocentes: sigue
    expect(view(impostorIds[0]).phase).toBe('turns');
    engine.removePlayer(innocentIds[1]); // 1 vs 1: paridad
    expect(view(impostorIds[0]).partidaResults[0]).toMatchObject({
      winner: 'impostor',
      reason: 'parity',
    });
  });

  it('en la votación se descartan sus votos y si ya votaron todos se resuelve', () => {
    const { engine, view, playTurns, players } = setup({ impostorCount: 2 }, 6);
    playTurns();
    const [a, b, c, d, e] = players.map((p) => p.id); // y un sexto que no vota
    engine.handleAction(a, { type: 'vote', payload: b }, PLAYER);
    engine.handleAction(b, { type: 'vote', payload: e }, PLAYER);
    engine.handleAction(c, { type: 'vote', payload: e }, PLAYER);
    engine.handleAction(d, { type: 'vote', payload: b }, PLAYER);
    // Se va e: se borran los votos que recibió y faltan b y c por votar de nuevo.
    engine.removePlayer(e);
    expect(view(a).voteCount).toBe(2);
    expect(view(a).phase).toBe('voting');
  });

  it('se puede sacar a alguien con la partida en pausa y seguir al reanudar', () => {
    const { engine, view } = setup({ impostorCount: 2 }, 6);
    jest.advanceTimersByTime(5000);
    const [first, second] = view('p1').turnOrder;
    engine.pause();
    engine.removePlayer(first);
    jest.advanceTimersByTime(120_000); // pausado: nada vence
    const observer = view('p1').turnOrder.find((id) => id !== first) ?? second;
    expect(view(observer).turnOrder[view(observer).currentTurnIndex]).toBe(
      second,
    );
    expect(engine.hasPlayer(first)).toBe(false);

    // Al reanudar, el turno del segundo corre con su timer completo (30 s).
    engine.resume();
    jest.advanceTimersByTime(29_999);
    expect(view(observer).currentTurnIndex).toBe(0);
    jest.advanceTimersByTime(1);
    expect(view(observer).wordsUsed).toEqual([
      { playerId: second, word: '(timeout)' },
    ]);
  });

  it('sacar a alguien que no está en la partida no cambia nada', () => {
    const { engine, view } = setup();
    const before = view('p1');
    engine.removePlayer('desconocido');
    expect(view('p1')).toEqual(before);
  });
});

describe('ImpostorEngine — reglas configurables (Fase 2)', () => {
  /** Hace votar a cada jugador según `ballot` (votante → votado). */
  const castVotes = (
    engine: ImpostorEngine,
    ballot: Record<string, string>,
  ) => {
    for (const [voter, target] of Object.entries(ballot)) {
      engine.handleAction(voter, { type: 'vote', payload: target }, PLAYER);
    }
  };

  it('pista de categoría: el impostor la ve sólo si está activada', () => {
    const off = setup({ impostorCategoryHint: false });
    expect(off.view(off.impostorIds[0]).category).toBeNull();
    expect(off.view(off.innocentIds[0]).category).toBe('Animales');

    const on = setup({ impostorCategoryHint: true });
    expect(on.view(on.impostorIds[0]).category).toBe('Animales');
    expect(on.view(on.impostorIds[0]).secretWord).toBeNull();
  });

  it('"saltear" con mayoría: no se expulsa a nadie', () => {
    const { engine, view, playTurns } = setup({ allowSkipVote: true });
    playTurns();
    castVotes(engine, { p1: 'skip', p2: 'skip', p3: 'skip', p4: 'p1' });
    const result = view('p1').results[0];
    expect(result.votedOutId).toBeNull();
    expect(result.voteCounts).toEqual({ skip: 3, p1: 1 });
  });

  it('"saltear" desactivado: el voto se ignora', () => {
    const { engine, view, playTurns } = setup({ allowSkipVote: false });
    playTurns();
    engine.handleAction('p1', { type: 'vote', payload: 'skip' }, PLAYER);
    expect(view('p1').voteCount).toBe(0);
  });

  it('empate con re-voto: se vota de nuevo sólo entre los empatados', () => {
    const { engine, view, playTurns } = setup({ tieBreak: 'revote' });
    playTurns();
    castVotes(engine, { p1: 'p2', p2: 'p1', p3: 'p2', p4: 'p1' }); // 2 a 2
    expect(view('p1').phase).toBe('voting');
    expect([...(view('p1').revoteCandidates ?? [])].sort()).toEqual([
      'p1',
      'p2',
    ]);
    expect(view('p1').voteCount).toBe(0);

    engine.handleAction('p3', { type: 'vote', payload: 'p4' }, PLAYER); // fuera del re-voto
    expect(view('p1').voteCount).toBe(0);

    castVotes(engine, { p1: 'p2', p2: 'p1', p3: 'p2', p4: 'p2' });
    const result = view('p1').results[0];
    expect(result.votedOutId).toBe('p2');
    expect(result.tieBreak).toBe('revote');
    expect(view('p1').revoteCandidates).toBeNull();
  });

  it('empate al azar: sale uno de los empatados', () => {
    const { engine, view, playTurns } = setup({ tieBreak: 'random' });
    playTurns();
    const random = jest.spyOn(Math, 'random').mockReturnValue(0);
    castVotes(engine, { p1: 'p2', p2: 'p1', p3: 'p2', p4: 'p1' });
    random.mockRestore();
    const result = view('p1').results[0];
    expect(['p1', 'p2']).toContain(result.votedOutId);
    expect(result.tieBreak).toBe('random');
  });

  it('voto secreto: en los resultados no se ve quién votó a quién, pero sí los conteos', () => {
    const { engine, view, playTurns } = setup({ secretVote: true });
    playTurns();
    castVotes(engine, { p1: 'p2', p2: 'p1', p3: 'p2', p4: 'p2' });
    expect(view('p1').phase).toBe('vote-results');
    expect(view('p1').votes).toEqual({});
    expect(view('p1').results[0].voteCounts).toEqual({ p2: 3, p1: 1 });
  });

  it('los puntos de la partida en curso se ocultan hasta que termina', () => {
    const { engine, view, playTurns, impostorIds, innocentIds } = setup(
      { impostorCount: 2 },
      6,
    );
    playTurns();
    // Todos los inocentes votan al primer impostor: sale, pero queda otro (1 vs 4).
    const ballot: Record<string, string> = {};
    for (const id of innocentIds) ballot[id] = impostorIds[0];
    ballot[impostorIds[0]] = innocentIds[0];
    ballot[impostorIds[1]] = innocentIds[0];
    castVotes(engine, ballot);
    expect(view(innocentIds[0]).phase).toBe('vote-results');
    expect(view(innocentIds[0]).scores).toEqual({});
  });

  it('las estadísticas cuentan partidas, roles, victorias y votos acertados', () => {
    const { engine, playTurns, everyoneVotes, impostorIds, innocentIds } =
      setup();
    playTurns();
    everyoneVotes(impostorIds[0]);
    jest.advanceTimersByTime(9000);

    const stats = engine.getPlayerStats();
    const impostor = stats.find((s) => s.playerId === impostorIds[0])!;
    const innocent = stats.find((s) => s.playerId === innocentIds[0])!;
    expect(impostor).toMatchObject({
      partidasPlayed: 1,
      partidasAsImpostor: 1,
      partidasWonAsImpostor: 0,
      innocentVotes: 0,
      points: 0,
    });
    expect(innocent).toMatchObject({
      partidasPlayed: 1,
      partidasAsInnocent: 1,
      partidasWonAsInnocent: 1,
      correctVotes: 1,
      innocentVotes: 1,
      points: 3,
    });
  });
});
