import {
  type FriendshipRow,
  presenceOf,
  relationWith,
  sanitizeSearch,
  splitRelations,
} from './social.rules.js';

const rows: FriendshipRow[] = [
  { requester_id: 'me', addressee_id: 'ana', status: 'accepted' },
  { requester_id: 'beto', addressee_id: 'me', status: 'accepted' },
  { requester_id: 'me', addressee_id: 'caro', status: 'pending' },
  { requester_id: 'dani', addressee_id: 'me', status: 'pending' },
  { requester_id: 'x', addressee_id: 'y', status: 'accepted' },
];

describe('relationWith', () => {
  it('amigos, sin importar quién pidió', () => {
    expect(relationWith(rows, 'me', 'ana')).toBe('friends');
    expect(relationWith(rows, 'me', 'beto')).toBe('friends');
  });

  it('solicitud enviada y recibida', () => {
    expect(relationWith(rows, 'me', 'caro')).toBe('outgoing');
    expect(relationWith(rows, 'me', 'dani')).toBe('incoming');
  });

  it('sin vínculo (incluye filas de otros)', () => {
    expect(relationWith(rows, 'me', 'x')).toBe('none');
    expect(relationWith([], 'me', 'ana')).toBe('none');
  });
});

describe('splitRelations', () => {
  it('separa amigos, recibidas y enviadas, ignorando filas ajenas', () => {
    expect(splitRelations(rows, 'me')).toEqual({
      friends: ['ana', 'beto'],
      incoming: ['dani'],
      outgoing: ['caro'],
    });
  });

  it('sin filas, todo vacío', () => {
    expect(splitRelations([], 'me')).toEqual({
      friends: [],
      incoming: [],
      outgoing: [],
    });
  });
});

describe('presenceOf', () => {
  it('desconectado no muestra la sala aunque siga en ella', () => {
    expect(
      presenceOf({ connected: false, roomCode: 'ABC123', roomState: 'lobby' }),
    ).toEqual({ status: 'offline', roomCode: null });
  });

  it('conectado sin sala', () => {
    expect(
      presenceOf({ connected: true, roomCode: null, roomState: null }),
    ).toEqual({ status: 'online', roomCode: null });
  });

  it('en el lobby de una sala: se puede unir', () => {
    expect(
      presenceOf({ connected: true, roomCode: 'ABC123', roomState: 'lobby' }),
    ).toEqual({ status: 'lobby', roomCode: 'ABC123' });
  });

  it('jugando: no se pasa el código (no se puede entrar a mitad de partida)', () => {
    expect(
      presenceOf({ connected: true, roomCode: 'ABC123', roomState: 'playing' }),
    ).toEqual({ status: 'playing', roomCode: null });
    expect(
      presenceOf({
        connected: true,
        roomCode: 'ABC123',
        roomState: 'finished',
      }),
    ).toEqual({ status: 'playing', roomCode: null });
  });
});

describe('sanitizeSearch', () => {
  it('acepta usernames, con o sin @, recortando espacios', () => {
    expect(sanitizeSearch('juan_1')).toBe('juan_1');
    expect(sanitizeSearch('  @Juan ')).toBe('Juan');
  });

  it('rechaza vacío, caracteres raros, muy largos o no-texto', () => {
    expect(sanitizeSearch('')).toBeNull();
    expect(sanitizeSearch('@')).toBeNull();
    expect(sanitizeSearch('ju*an')).toBeNull();
    expect(sanitizeSearch('a,b)')).toBeNull();
    expect(sanitizeSearch('a'.repeat(21))).toBeNull();
    expect(sanitizeSearch(42)).toBeNull();
    expect(sanitizeSearch(null)).toBeNull();
  });
});
