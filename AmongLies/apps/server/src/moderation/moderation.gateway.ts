import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type {
  AdminUserView,
  ModerationResult,
  ReportView,
} from '@amonglies/shared';
import { GATEWAY_OPTIONS } from '../gateway.options.js';
import { PlayerService } from '../player/player.service.js';
import { RoomStore } from '../room/room.store.js';
import { GameGateway } from '../game/game.gateway.js';
import { AccountService } from './account.service.js';
import { ModerationService } from './moderation.service.js';
import {
  RateLimiter,
  sanitizeReport,
  suspensionEnd,
} from './moderation.rules.js';

type Data = Record<string, unknown> | undefined;
const fail = (error: Extract<ModerationResult, { ok: false }>['error']) =>
  ({ ok: false, error }) as const;

/** Reportes (cualquier jugador) y panel de admin (sólo admins, verificado en la base). */
@WebSocketGateway(GATEWAY_OPTIONS)
export class ModerationGateway {
  @WebSocketServer()
  server!: Server;

  /** Máximo 5 reportes cada 10 minutos por jugador. */
  private reportLimiter = new RateLimiter(5, 10 * 60 * 1000);

  constructor(
    private readonly moderation: ModerationService,
    private readonly accounts: AccountService,
    private readonly playerService: PlayerService,
    private readonly roomStore: RoomStore,
    private readonly gameGateway: GameGateway,
  ) {}

  // ─── Reportes ────────────────────────────────────────────────────────────

  @SubscribeMessage('report:create')
  async report(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: Data,
  ): Promise<ModerationResult> {
    const session = this.playerService.getSession(client.id);
    const valid = sanitizeReport(data);
    if (!session || !valid) return fail('invalid');

    const room = session.roomCode
      ? this.roomStore.getRoom(session.roomCode)
      : undefined;
    const me = room?.players.find((p) => p.id === session.playerId);
    const reporterNickname = me?.nickname ?? 'Invitado';

    let target: {
      userId: string | null;
      nickname: string | null;
      itemId: string | null;
    };
    if (data?.kind === 'player') {
      const player = room?.players.find((p) => p.id === data.playerId);
      if (!room || !player || player.id === session.playerId)
        return fail('not_found');
      target = {
        userId: this.playerService.getUserIdByPlayerId(player.id),
        nickname: player.nickname,
        itemId: null,
      };
    } else if (
      data?.kind === 'workshop_item' &&
      typeof data.itemId === 'string'
    ) {
      try {
        if (!(await this.moderation.isPublishedItem(data.itemId)))
          return fail('not_found');
      } catch {
        return fail('unavailable');
      }
      target = { userId: null, nickname: null, itemId: data.itemId };
    } else {
      return fail('invalid');
    }

    if (!this.reportLimiter.take(session.userId ?? client.id))
      return fail('too_many_reports');

    // Últimos mensajes del chat de la sala como evidencia.
    const evidence = (room?.chat ?? [])
      .filter((m) => m.type === 'player')
      .slice(-20)
      .map((m) => ({
        nickname: m.playerNickname,
        message: m.message,
        timestamp: m.timestamp,
      }));

    try {
      await this.moderation.createReport({
        kind: data.kind,
        reporterId: session.userId,
        reporterNickname,
        targetUserId: target.userId,
        targetNickname: target.nickname,
        targetItemId: target.itemId,
        reason: valid.reason,
        details: valid.details,
        evidence: data.kind === 'player' ? evidence : [],
        roomCode: data.kind === 'player' ? (room?.code ?? null) : null,
      });
      return { ok: true };
    } catch {
      return fail('unavailable');
    }
  }

  @SubscribeMessage('account:refresh')
  async refresh(@ConnectedSocket() client: Socket): Promise<void> {
    const userId = this.playerService.getSession(client.id)?.userId;
    if (userId) await this.accounts.load(userId);
  }

  @SubscribeMessage('account:delete')
  async deleteAccount(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: Data,
  ): Promise<ModerationResult> {
    const session = this.playerService.getSession(client.id);
    if (!session?.userId) return fail('guest');
    try {
      if (
        !(await this.accounts.deleteAccount(
          session.userId,
          data?.confirmUsername,
        ))
      )
        return fail('invalid');
    } catch {
      return fail('unavailable');
    }
    // Sale de su sala como cualquiera que se va.
    if (session.roomCode && session.playerId) {
      void client.leave(session.roomCode);
      this.gameGateway.removePlayerFromRoom(session.roomCode, session.playerId);
    }
    return { ok: true };
  }

  // ─── Panel de admin ──────────────────────────────────────────────────────

  private async admin(client: Socket): Promise<string | null> {
    const userId = this.playerService.getSession(client.id)?.userId;
    return userId && (await this.accounts.isAdmin(userId)) ? userId : null;
  }

  private async run<T extends object>(
    client: Socket,
    action: (adminId: string) => Promise<ModerationResult<T>>,
  ): Promise<ModerationResult<T>> {
    const adminId = await this.admin(client);
    if (!adminId) return fail('not_admin');
    try {
      return await action(adminId);
    } catch {
      return fail('unavailable');
    }
  }

  @SubscribeMessage('admin:reports')
  reports(@ConnectedSocket() client: Socket, @MessageBody() data: Data) {
    const status = data?.status;
    return this.run<{ reports: ReportView[] }>(client, async () =>
      status === 'open' || status === 'resolved' || status === 'dismissed'
        ? {
            ok: true,
            reports: await this.moderation.listReports(status),
          }
        : fail('invalid'),
    );
  }

  @SubscribeMessage('admin:resolve')
  resolve(@ConnectedSocket() client: Socket, @MessageBody() data: Data) {
    return this.run<object>(client, async (adminId) => {
      const status = data?.status;
      if (
        typeof data?.id !== 'string' ||
        (status !== 'resolved' && status !== 'dismissed')
      )
        return fail('invalid');
      const resolution =
        typeof data.resolution === 'string' ? data.resolution.trim() : '';
      return (await this.moderation.resolve(
        data.id,
        adminId,
        status,
        resolution,
      ))
        ? { ok: true }
        : fail('not_found');
    });
  }

  @SubscribeMessage('admin:users')
  users(@ConnectedSocket() client: Socket, @MessageBody() data: Data) {
    return this.run<{ users: AdminUserView[] }>(client, async () => ({
      ok: true,
      users: await this.accounts.search(
        typeof data?.query === 'string' ? data.query : '',
      ),
    }));
  }

  @SubscribeMessage('admin:suspend')
  suspend(@ConnectedSocket() client: Socket, @MessageBody() data: Data) {
    return this.run<object>(client, async (adminId) => {
      const userId = data?.userId;
      const days = data?.days === null ? null : Number(data?.days);
      const until = suspensionEnd(days, Date.now());
      if (typeof userId !== 'string' || userId === adminId || !until)
        return fail('invalid');
      const reason =
        typeof data?.reason === 'string'
          ? data.reason.trim().slice(0, 200)
          : '';
      const ok = await this.accounts.update(userId, {
        suspended_until: until,
        suspension_reason: reason || null,
      });
      if (!ok) return fail('not_found');
      this.kickSuspended(userId, until, reason || null);
      return { ok: true };
    });
  }

  @SubscribeMessage('admin:unsuspend')
  unsuspend(@ConnectedSocket() client: Socket, @MessageBody() data: Data) {
    return this.run<object>(client, async () => {
      if (typeof data?.userId !== 'string') return fail('invalid');
      return (await this.accounts.update(data.userId, {
        suspended_until: null,
        suspension_reason: null,
      }))
        ? { ok: true }
        : fail('not_found');
    });
  }

  @SubscribeMessage('admin:set-admin')
  setAdmin(@ConnectedSocket() client: Socket, @MessageBody() data: Data) {
    return this.run<object>(client, async (adminId) => {
      // No te podés sacar el rol a vos mismo (para no quedarse sin admins).
      if (typeof data?.userId !== 'string' || data.userId === adminId)
        return fail('invalid');
      return (await this.accounts.update(data.userId, {
        is_admin: data.isAdmin === true,
      }))
        ? { ok: true }
        : fail('not_found');
    });
  }

  @SubscribeMessage('admin:workshop')
  workshop(@ConnectedSocket() client: Socket, @MessageBody() data: Data) {
    return this.run<object>(client, async () => {
      const action = data?.action;
      if (
        typeof data?.itemId !== 'string' ||
        (action !== 'hide' && action !== 'delete')
      )
        return fail('invalid');
      return (await this.moderation.workshopAction(data.itemId, action))
        ? { ok: true }
        : fail('not_found');
    });
  }

  /** Si la cuenta suspendida está conectada, se le avisa y se la saca de su sala. */
  private kickSuspended(
    userId: string,
    until: string,
    reason: string | null,
  ): void {
    const account = this.playerService.getAccount(userId);
    if (!account?.socketId) return;
    const socket = this.server.sockets.sockets.get(account.socketId);
    const session = this.playerService.getSession(account.socketId);
    if (session?.roomCode && session.playerId) {
      void socket?.leave(session.roomCode);
      this.gameGateway.removePlayerFromRoom(session.roomCode, session.playerId);
    }
    socket?.emit('account:suspended', { until, reason });
  }
}
