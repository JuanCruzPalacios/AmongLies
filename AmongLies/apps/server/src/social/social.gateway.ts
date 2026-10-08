import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { v4 as uuid } from 'uuid';
import type {
  FriendProfile,
  Presence,
  RoomInvite,
  ServerEvents,
} from '@amonglies/shared';
import { GATEWAY_OPTIONS } from '../gateway.options.js';
import { PlayerService } from '../player/player.service.js';
import { RoomStore } from '../room/room.store.js';
import { SocialService, type Result } from './social.service.js';
import { AccountService } from '../moderation/account.service.js';
import { presenceOf } from './social.rules.js';

/** Cada cuánto se revisa si cambió la presencia de las cuentas conectadas. */
const PRESENCE_INTERVAL_MS = 2000;
const INVITE_TTL_MS = 5 * 60 * 1000;
/** No se puede invitar dos veces seguidas al mismo amigo. */
const INVITE_COOLDOWN_MS = 10 * 1000;

interface TrackedAccount {
  friends: Set<string>;
  profile: FriendProfile | null;
  /** Última presencia avisada a los amigos (serializada). */
  lastPresence: string;
}

/**
 * Amigos, presencia, solicitudes e invitaciones, por el mismo socket del juego.
 * Sólo para cuentas: los invitados no tienen amigos.
 */
@WebSocketGateway(GATEWAY_OPTIONS)
export class SocialGateway implements OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private tracked = new Map<string, TrackedAccount>();
  private lastInvite = new Map<string, number>();
  private loop?: ReturnType<typeof setInterval>;

  constructor(
    private readonly social: SocialService,
    private readonly playerService: PlayerService,
    private readonly roomStore: RoomStore,
    private readonly accounts: AccountService,
  ) {}

  onModuleInit() {
    this.loop = setInterval(() => this.refreshPresence(), PRESENCE_INTERVAL_MS);
    this.loop.unref();
  }

  onModuleDestroy() {
    clearInterval(this.loop);
  }

  /** Lo llama RoomGateway cuando se identifica una cuenta. */
  async onAccountConnected(userId: string): Promise<void> {
    try {
      const [friends, profile] = await Promise.all([
        this.social.friendIds(userId),
        this.social.profile(userId),
      ]);
      this.tracked.set(userId, {
        friends: new Set(friends),
        profile,
        lastPresence: '',
      });
      await this.pushState(userId);
      this.refreshPresence();
    } catch {
      // Sin Supabase el juego sigue andando; sólo no hay amigos.
    }
  }

  // ─── Eventos ─────────────────────────────────────────────────────────────

  @SubscribeMessage('social:search')
  async handleSearch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { query?: unknown },
  ): Promise<FriendProfile[]> {
    const me = this.userOf(client);
    return me ? this.social.search(me, data?.query) : [];
  }

  @SubscribeMessage('social:request')
  async handleRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { username?: unknown },
  ): Promise<Result> {
    const me = this.userOf(client);
    if (!me) return { ok: false, error: 'guest' };
    const result = await this.social.request(me, data?.username);
    if (!result.ok) return result;

    const other = result.target.userId;
    if (result.accepted) {
      this.link(me, other);
    } else {
      const profile = this.tracked.get(me)?.profile;
      if (profile) this.emitTo(other, 'social:request-received', profile);
    }
    await Promise.all([this.pushState(me), this.pushState(other)]);
    return { ok: true };
  }

  @SubscribeMessage('social:respond')
  async handleRespond(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId?: unknown; accept?: unknown },
  ): Promise<Result> {
    const me = this.userOf(client);
    if (!me) return { ok: false, error: 'guest' };
    const result = await this.social.respond(me, data?.userId, data?.accept);
    if (!result.ok) return result;
    const other = data.userId as string;
    if (result.accepted) this.link(me, other);
    await Promise.all([this.pushState(me), this.pushState(other)]);
    return { ok: true };
  }

  @SubscribeMessage('social:remove')
  async handleRemove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId?: unknown },
  ): Promise<Result> {
    const me = this.userOf(client);
    if (!me) return { ok: false, error: 'guest' };
    const result = await this.social.remove(me, data?.userId);
    if (!result.ok) return result;
    const other = data.userId as string;
    this.tracked.get(me)?.friends.delete(other);
    this.tracked.get(other)?.friends.delete(me);
    await Promise.all([this.pushState(me), this.pushState(other)]);
    return { ok: true };
  }

  @SubscribeMessage('social:invite')
  handleInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId?: unknown },
  ): Result {
    const me = this.userOf(client);
    if (!me) return { ok: false, error: 'guest' };
    const target = data?.userId;
    const account = this.tracked.get(me);
    if (typeof target !== 'string' || !account?.friends.has(target))
      return { ok: false, error: 'not_friends' };

    const presence = this.presence(me);
    if (presence.status !== 'lobby' || !presence.roomCode)
      return { ok: false, error: 'not_in_room' };
    if (this.presence(target).status === 'offline')
      return { ok: false, error: 'friend_offline' };
    if (!this.accounts.flags(target).allowInvites)
      return { ok: false, error: 'invites_disabled' };

    const key = `${me}:${target}`;
    const now = Date.now();
    if (now - (this.lastInvite.get(key) ?? 0) < INVITE_COOLDOWN_MS)
      return { ok: false, error: 'too_soon' };
    this.lastInvite.set(key, now);

    const invite: RoomInvite = {
      id: uuid(),
      from: account.profile ?? { userId: me, username: '?', avatarId: 'fox' },
      roomCode: presence.roomCode,
      expiresAt: now + INVITE_TTL_MS,
    };
    this.emitTo(target, 'social:invited', invite);
    return { ok: true };
  }

  // ─── Presencia ───────────────────────────────────────────────────────────

  /** Lo que ven los amigos (si eligió aparecer desconectado, se muestra así). */
  presence(userId: string): Presence {
    if (this.accounts.flags(userId).appearOffline)
      return { status: 'offline', roomCode: null };
    const account = this.playerService.getAccount(userId);
    const room = account?.roomCode
      ? this.roomStore.getRoom(account.roomCode)
      : undefined;
    return presenceOf({
      connected: !!account?.socketId,
      roomCode: room?.code ?? null,
      roomState: room?.state ?? null,
    });
  }

  /** Avisa a los amigos de cada cuenta cuya presencia cambió. */
  private refreshPresence(): void {
    for (const [userId, account] of this.tracked) {
      const presence = this.presence(userId);
      const serialized = JSON.stringify(presence);
      if (serialized === account.lastPresence) continue;
      account.lastPresence = serialized;
      for (const friend of account.friends) {
        this.emitTo(friend, 'social:presence', { userId, presence });
      }
      if (presence.status === 'offline') this.tracked.delete(userId);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private userOf(client: Socket): string | null {
    return this.playerService.getSession(client.id)?.userId ?? null;
  }

  private link(a: string, b: string): void {
    this.tracked.get(a)?.friends.add(b);
    this.tracked.get(b)?.friends.add(a);
  }

  private emitTo<E extends keyof ServerEvents>(
    userId: string,
    event: E,
    ...args: Parameters<ServerEvents[E]>
  ): void {
    const socketId = this.playerService.getAccount(userId)?.socketId;
    const socket = socketId
      ? this.server.sockets.sockets.get(socketId)
      : undefined;
    socket?.emit(event, ...args);
  }

  private async pushState(userId: string): Promise<void> {
    if (!this.playerService.getAccount(userId)?.socketId) return;
    try {
      const state = await this.social.state(userId, (id) => this.presence(id));
      this.emitTo(userId, 'social:state', state);
    } catch {
      // Se reintenta en el próximo cambio.
    }
  }
}
