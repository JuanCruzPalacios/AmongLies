import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GATEWAY_OPTIONS } from '../gateway.options.js';
import { v4 as uuid } from 'uuid';
import type { GuestIdentity, Player, SocketAuth } from '@amonglies/shared';
import {
  RECONNECT_GRACE_PERIOD_MS,
  containsProfanity,
  getWordListsByLocale,
} from '@amonglies/shared';
import { RoomStore } from './room.store.js';
import { parseIdentity, sanitizeRoomSettings } from './room.validation.js';
import { WORD_LISTS_KEY } from '../game/settings.js';
import { GameGateway } from '../game/game.gateway.js';
import { PlayerService } from '../player/player.service.js';
import { AuthService } from '../auth/auth.service.js';
import { SocialGateway } from '../social/social.gateway.js';
import { AccountService } from '../moderation/account.service.js';

const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

@WebSocketGateway(GATEWAY_OPTIONS)
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  /** Jugadores desconectados esperando volver (playerId → timer). */
  private graceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly roomStore: RoomStore,
    private readonly playerService: PlayerService,
    private readonly authService: AuthService,
    private readonly gameGateway: GameGateway,
    private readonly socialGateway: SocialGateway,
    private readonly accounts: AccountService,
  ) {}

  // ─── Conexión e identidad ────────────────────────────────────────────────

  /**
   * Identifica al socket (cuenta verificada o token de invitado) y, si esa
   * identidad estaba en una sala, la devuelve a su lugar.
   */
  async handleConnection(client: Socket) {
    const auth = (client.handshake.auth ?? {}) as SocketAuth;
    const userId = await this.authService.getUserId(auth.accessToken);
    if (!client.connected) return;

    const token =
      typeof auth.sessionToken === 'string' &&
      SESSION_TOKEN_PATTERN.test(auth.sessionToken)
        ? auth.sessionToken
        : uuid();
    const key = userId ? `user:${userId}` : `guest:${token}`;

    const previousSocketId = this.playerService.register(
      client.id,
      key,
      userId,
    );
    if (previousSocketId) {
      const previous = this.server.sockets.sockets.get(previousSocketId);
      previous?.emit('session:replaced');
      previous?.disconnect(true);
    }
    // Primero se registra la identidad (los mensajes pueden llegar mientras tanto)
    // y después se leen las marcas de la cuenta (suspensión, privacidad).
    if (userId) await this.accounts.load(userId);
    if (!client.connected) return;
    if (userId) void this.socialGateway.onAccountConnected(userId);

    const saved = this.playerService.getRestorable(key);
    const room = saved ? this.roomStore.getRoom(saved.roomCode) : undefined;
    const player = room?.players.find((p) => p.id === saved?.playerId);
    // Una cuenta suspendida no vuelve a su sala.
    if (saved && room && player && this.accounts.isSuspended(userId)) {
      this.gameGateway.removePlayerFromRoom(room.code, player.id);
    }
    if (!saved || !room || !player || this.accounts.isSuspended(userId)) {
      if (saved) this.playerService.clearRoom(saved.playerId);
      client.emit('session:ready', { restored: false });
      return;
    }

    this.clearGraceTimer(player.id);
    player.isConnected = true;
    await client.join(room.code);
    client.emit('session:ready', { restored: true, room, playerId: player.id });
    client.to(room.code).emit('player:reconnected', { playerId: player.id });
    this.gameGateway.syncAfterReconnect(room.code);
  }

  handleDisconnect(client: Socket) {
    const session = this.playerService.disconnect(client.id);
    if (!session?.roomCode || !session.playerId) return;

    const room = this.roomStore.getRoom(session.roomCode);
    const player = room?.players.find((p) => p.id === session.playerId);
    if (!room || !player) return;

    player.isConnected = false;
    this.server
      .to(room.code)
      .emit('player:disconnected', { playerId: player.id });
    this.gameGateway.pauseForDisconnect(room.code, player.id);
    this.startGraceTimer(room.code, player.id);
  }

  /**
   * En el lobby, si no vuelve a tiempo se lo saca de la sala. Durante una
   * partida se espera a que vuelva o a que se decida seguir sin él.
   */
  private startGraceTimer(roomCode: string, playerId: string): void {
    this.clearGraceTimer(playerId);
    const timer = setTimeout(() => {
      this.graceTimers.delete(playerId);
      const room = this.roomStore.getRoom(roomCode);
      const player = room?.players.find((p) => p.id === playerId);
      if (!room || !player || player.isConnected) return;

      if (room.state === 'playing') {
        this.startGraceTimer(roomCode, playerId);
      } else {
        this.gameGateway.removePlayerFromRoom(roomCode, playerId);
      }
    }, RECONNECT_GRACE_PERIOD_MS);
    this.graceTimers.set(playerId, timer);
  }

  private clearGraceTimer(playerId: string): void {
    const timer = this.graceTimers.get(playerId);
    if (timer) clearTimeout(timer);
    this.graceTimers.delete(playerId);
  }

  // ─── Salas ───────────────────────────────────────────────────────────────

  @SubscribeMessage('room:create')
  async handleCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown,
  ) {
    const identity = await this.parseOrReject(client, data);
    if (!identity) return;
    this.leaveCurrentRoom(client);

    const player = this.newPlayer(client, identity, true);
    const room = this.roomStore.createRoom(player);
    this.playerService.setRoom(client.id, player.id, room.code);
    await client.join(room.code);

    client.emit('room:created', { room, playerId: player.id });
  }

  @SubscribeMessage('room:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { code?: unknown },
  ) {
    const identity = await this.parseOrReject(client, data);
    if (!identity) return;

    const code =
      typeof data.code === 'string' ? data.code.trim().toUpperCase() : '';
    const room = this.roomStore.getRoom(code);
    if (!room) {
      client.emit('room:error', {
        message: 'Room not found',
        code: 'ROOM_NOT_FOUND',
      });
      return;
    }
    if (room.state !== 'lobby') {
      client.emit('room:error', {
        message: 'Game already in progress',
        code: 'GAME_IN_PROGRESS',
      });
      return;
    }
    if (
      room.settings.maxPlayers > 0 &&
      room.players.length >= room.settings.maxPlayers
    ) {
      client.emit('room:error', { message: 'Room is full', code: 'ROOM_FULL' });
      return;
    }

    this.leaveCurrentRoom(client);
    const player = this.newPlayer(client, identity, false);
    this.roomStore.addPlayer(code, player);
    this.playerService.setRoom(client.id, player.id, code);
    await client.join(code);

    client.emit('room:joined', { room, playerId: player.id });
    client.to(code).emit('room:player-joined', { player });
  }

  @SubscribeMessage('room:leave')
  handleLeave(@ConnectedSocket() client: Socket) {
    this.leaveCurrentRoom(client);
  }

  @SubscribeMessage('room:kick')
  handleKick(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { playerId?: unknown },
  ) {
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode) return;

    const room = this.roomStore.getRoom(session.roomCode);
    if (!room || room.adminId !== session.playerId) return;
    if (
      typeof data?.playerId !== 'string' ||
      data.playerId === session.playerId
    )
      return;
    if (!room.players.some((p) => p.id === data.playerId)) return;

    const targetSocketId = this.playerService.getSocketIdByPlayerId(
      data.playerId,
    );
    const targetSocket = targetSocketId
      ? this.server.sockets.sockets.get(targetSocketId)
      : undefined;

    this.clearGraceTimer(data.playerId);
    this.gameGateway.removePlayerFromRoom(room.code, data.playerId);
    if (targetSocket) {
      targetSocket.emit('room:kicked');
      void targetSocket.leave(room.code);
    }
  }

  @SubscribeMessage('room:update-settings')
  handleUpdateSettings(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown,
  ) {
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode) return;

    const room = this.roomStore.getRoom(session.roomCode);
    if (!room || room.adminId !== session.playerId) return;

    const previousLocale = room.settings.locale;
    room.settings = sanitizeRoomSettings(data, room.settings);

    // Las listas de palabras son por idioma: al cambiarlo se eligen todas las del nuevo.
    if (
      room.settings.locale !== previousLocale &&
      WORD_LISTS_KEY in room.gameSettings
    ) {
      room.gameSettings[WORD_LISTS_KEY] = getWordListsByLocale(
        room.settings.locale,
      ).map((list) => list.id);
    }

    this.server.to(session.roomCode).emit('room:updated', { room });
  }

  @SubscribeMessage('room:transfer-admin')
  handleTransferAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { playerId?: unknown },
  ) {
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode) return;

    const room = this.roomStore.getRoom(session.roomCode);
    if (!room || room.adminId !== session.playerId) return;

    const currentAdmin = room.players.find((p) => p.id === session.playerId);
    const newAdmin = room.players.find((p) => p.id === data?.playerId);
    if (!currentAdmin || !newAdmin) return;

    currentAdmin.isAdmin = false;
    newAdmin.isAdmin = true;
    room.adminId = newAdmin.id;

    this.server.to(session.roomCode).emit('room:updated', { room });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async parseOrReject(
    client: Socket,
    data: unknown,
  ): Promise<GuestIdentity | null> {
    const userId = this.playerService.getSession(client.id)?.userId;
    if (userId) await this.accounts.ready(userId);
    if (this.accounts.isSuspended(userId)) {
      client.emit('room:error', {
        message: 'Account suspended',
        code: 'SUSPENDED',
      });
      return null;
    }
    const nickname = (data as { nickname?: unknown } | null)?.nickname;
    if (typeof nickname === 'string' && containsProfanity(nickname)) {
      client.emit('room:error', {
        message: 'Nickname not allowed',
        code: 'NICKNAME_NOT_ALLOWED',
      });
      return null;
    }
    const identity = parseIdentity(data);
    if (!identity) {
      client.emit('room:error', {
        message: 'Invalid nickname or avatar',
        code: 'INVALID_IDENTITY',
      });
    }
    return identity;
  }

  private newPlayer(
    client: Socket,
    identity: GuestIdentity,
    isAdmin: boolean,
  ): Player {
    const session = this.playerService.getSession(client.id);
    return {
      id: uuid(),
      ...identity,
      isAdmin,
      isConnected: true,
      isGuest: !session?.userId,
    };
  }

  /** Sale de la sala en la que está (si está en alguna). */
  private leaveCurrentRoom(client: Socket): void {
    const session = this.playerService.getSession(client.id);
    if (!session?.roomCode || !session.playerId) return;

    this.clearGraceTimer(session.playerId);
    void client.leave(session.roomCode);
    this.gameGateway.removePlayerFromRoom(session.roomCode, session.playerId);
  }
}
