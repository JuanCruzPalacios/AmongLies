import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { GATEWAY_OPTIONS } from '../gateway.options.js';
import { PlayerService } from '../player/player.service.js';
import { WorkshopService, type WorkshopResult } from './workshop.service.js';

type Data = Record<string, unknown> | undefined;
const GUEST: WorkshopResult = { ok: false, error: 'guest' };

/** Escrituras del workshop (las lecturas van directo a Supabase con RLS). */
@WebSocketGateway(GATEWAY_OPTIONS)
export class WorkshopGateway {
  constructor(
    private readonly workshop: WorkshopService,
    private readonly playerService: PlayerService,
  ) {}

  private userOf(client: Socket): string | null {
    return this.playerService.getSession(client.id)?.userId ?? null;
  }

  @SubscribeMessage('workshop:save')
  save(@ConnectedSocket() client: Socket, @MessageBody() data: unknown) {
    const me = this.userOf(client);
    return me ? this.workshop.save(me, data) : GUEST;
  }

  @SubscribeMessage('workshop:publish')
  publish(@ConnectedSocket() client: Socket, @MessageBody() data: Data) {
    const me = this.userOf(client);
    return me ? this.workshop.publish(me, data?.id, data?.published) : GUEST;
  }

  @SubscribeMessage('workshop:delete')
  remove(@ConnectedSocket() client: Socket, @MessageBody() data: Data) {
    const me = this.userOf(client);
    return me ? this.workshop.remove(me, data?.id) : GUEST;
  }

  @SubscribeMessage('workshop:copy')
  copy(@ConnectedSocket() client: Socket, @MessageBody() data: Data) {
    const me = this.userOf(client);
    return me ? this.workshop.copy(me, data?.id) : GUEST;
  }

  @SubscribeMessage('workshop:update-copy')
  updateCopy(@ConnectedSocket() client: Socket, @MessageBody() data: Data) {
    const me = this.userOf(client);
    return me ? this.workshop.updateCopy(me, data?.id) : GUEST;
  }

  @SubscribeMessage('workshop:like')
  like(@ConnectedSocket() client: Socket, @MessageBody() data: Data) {
    const me = this.userOf(client);
    return me ? this.workshop.like(me, data?.id, data?.like) : GUEST;
  }
}
