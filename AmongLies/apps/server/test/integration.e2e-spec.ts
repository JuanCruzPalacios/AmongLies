import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { ChatMessage, Room, RoomPublicView } from '@amonglies/shared';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';

// uuid sólo se publica como ESM y Jest no lo carga: se usa el generador de Node.
jest.mock('uuid', () => ({ v4: () => randomUUID() }));

/**
 * Pruebas de integración: levantan el servidor completo (Nest + Socket.io) en un puerto
 * libre y lo usan como lo usa el navegador, por HTTP y por WebSocket. Corren sin
 * credenciales de Supabase, igual que el servidor para invitados.
 */
describe('Servidor (integración)', () => {
  let app: INestApplication;
  let http: Server;
  let url: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    http = app.getHttpServer() as Server;
    const { port } = http.address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
  });

  afterEach(() => {
    sockets.splice(0).forEach((s) => s.disconnect());
  });

  afterAll(async () => {
    await app.close();
  });

  /** Conecta un cliente y espera a que el servidor lo identifique. */
  async function connect(): Promise<Socket> {
    const socket = io(url, { transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    await once(socket, 'session:ready');
    return socket;
  }

  function once<T = unknown>(
    socket: Socket,
    event: string,
    ms = 3000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`No llegó ${event}`)),
        ms,
      );
      socket.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  /** Comprueba que un evento NO llega en el tiempo dado. */
  function never(socket: Socket, event: string, ms = 400): Promise<void> {
    return new Promise((resolve, reject) => {
      const handler = () => reject(new Error(`Llegó ${event} y no debía`));
      socket.once(event, handler);
      setTimeout(() => {
        socket.off(event, handler);
        resolve();
      }, ms);
    });
  }

  type Joined = { room: Room; playerId: string };

  const identity = (nickname: string) => ({
    nickname,
    avatarId: 'fox',
    locale: 'es',
  });

  async function createRoom(nickname = 'Anfitrion') {
    const host = await connect();
    host.emit('room:create', identity(nickname));
    const { room, playerId } = await once<Joined>(host, 'room:created');
    return { host, code: room.code, hostId: playerId };
  }

  async function joinRoom(code: string, nickname: string) {
    const socket = await connect();
    socket.emit('room:join', { code, ...identity(nickname) });
    const { playerId } = await once<Joined>(socket, 'room:joined');
    return { socket, playerId };
  }

  // ── HTTP ──

  it('GET /health responde 200 con { ok: true }', async () => {
    await request(http).get('/health').expect(200).expect({ ok: true });
  });

  it('GET /rooms/public lista sólo las salas públicas', async () => {
    const empty = await request(http).get('/rooms/public').expect(200);
    expect(empty.body as RoomPublicView[]).toEqual([]);

    const { host, code } = await createRoom();
    host.emit('room:update-settings', { isPrivate: false });
    await once(host, 'room:updated');

    const res = await request(http).get('/rooms/public').expect(200);
    const rooms = res.body as RoomPublicView[];
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({ code, playerCount: 1 });
  });

  it('una ruta inexistente responde 404 sin exponer detalles internos', async () => {
    const res = await request(http).get('/admin/secreto').expect(404);
    expect(res.body).toEqual({
      message: 'Cannot GET /admin/secreto',
      error: 'Not Found',
      statusCode: 404,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/at |\.ts|node_modules/);
  });

  // ── Salas por Socket.io ──

  it('crear una sala devuelve un código de 6 caracteres y al creador como anfitrión', async () => {
    const host = await connect();
    host.emit('room:create', identity('Juan'));
    const { room, playerId } = await once<Joined>(host, 'room:created');
    expect(room.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(room.adminId).toBe(playerId);
    expect(room.settings.isPrivate).toBe(true);
  });

  it('rechaza un apodo inválido con INVALID_IDENTITY', async () => {
    const socket = await connect();
    socket.emit('room:create', identity('J'));
    await expect(once(socket, 'room:error')).resolves.toMatchObject({
      code: 'INVALID_IDENTITY',
    });
  });

  it('rechaza un apodo con insultos con NICKNAME_NOT_ALLOWED', async () => {
    const socket = await connect();
    socket.emit('room:create', identity('pelotudo'));
    await expect(once(socket, 'room:error')).resolves.toMatchObject({
      code: 'NICKNAME_NOT_ALLOWED',
    });
  });

  it('unirse a un código inexistente responde ROOM_NOT_FOUND', async () => {
    const socket = await connect();
    socket.emit('room:join', { code: 'ZZZZZZ', ...identity('Mica') });
    await expect(once(socket, 'room:error')).resolves.toMatchObject({
      code: 'ROOM_NOT_FOUND',
    });
  });

  it('una sala con cupo lleno responde ROOM_FULL', async () => {
    const { host, code } = await createRoom();
    host.emit('room:update-settings', { maxPlayers: 2 });
    await once(host, 'room:updated');
    await joinRoom(code, 'Sofi');

    const third = await connect();
    third.emit('room:join', { code, ...identity('Lucas') });
    await expect(once(third, 'room:error')).resolves.toMatchObject({
      code: 'ROOM_FULL',
    });
  });

  it('un jugador que no es anfitrión no puede expulsar ni cambiar la configuración', async () => {
    const { host, code, hostId } = await createRoom();
    const { socket: player } = await joinRoom(code, 'Sofi');

    player.emit('room:kick', { playerId: hostId });
    player.emit('room:update-settings', { maxPlayers: 1 });
    await Promise.all([
      never(host, 'room:kicked'),
      never(host, 'room:updated'),
    ]);

    const res = await request(http).get('/rooms/public');
    expect(res.status).toBe(200);
  });

  it('el anfitrión expulsa a un jugador y el resto recibe la salida', async () => {
    const { host, code } = await createRoom();
    const { socket: player, playerId } = await joinRoom(code, 'Sofi');

    const left = once(host, 'room:player-left');
    const kicked = once(player, 'room:kicked');
    host.emit('room:kick', { playerId });
    await kicked;
    await expect(left).resolves.toMatchObject({ playerId });
  });

  it('no se puede empezar un juego con menos de 4 jugadores', async () => {
    const { host, code } = await createRoom();
    await joinRoom(code, 'Sofi');
    host.emit('game:select', { gameId: 'impostor' });
    await once(host, 'room:updated');
    host.emit('game:start');
    await expect(once(host, 'game:error')).resolves.toMatchObject({
      code: 'not_enough_players',
    });
  });

  it('el chat recorta los mensajes largos y censura los insultos', async () => {
    const { host, code } = await createRoom();
    const { socket: player } = await joinRoom(code, 'Sofi');

    const received = once<ChatMessage>(host, 'chat:message');
    player.emit('chat:send', { message: `sos un pelotudo ${'a'.repeat(300)}` });
    const msg = await received;
    expect(msg.message.length).toBeLessThanOrEqual(200);
    expect(msg.message).not.toMatch(/pelotudo/i);
  });

  it('un invitado no puede usar el panel de administración', async () => {
    const socket = await connect();
    const result: unknown = await socket
      .timeout(3000)
      .emitWithAck('admin:reports', { status: 'open' });
    expect(result).toEqual({ ok: false, error: 'not_admin' });
  });
});
