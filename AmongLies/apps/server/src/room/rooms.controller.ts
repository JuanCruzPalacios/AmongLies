import { Controller, Get } from '@nestjs/common';
import type { RoomPublicView } from '@amonglies/shared';
import { RoomStore } from './room.store.js';

/** Listado de salas públicas (REST: se consulta desde la home sin estar en una sala). */
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomStore: RoomStore) {}

  @Get('public')
  listPublic(): RoomPublicView[] {
    return this.roomStore.listPublic().slice(0, 50);
  }
}
