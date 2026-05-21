import { Module } from '@nestjs/common';
import { RoomGateway } from './room.gateway.js';
import { RoomStore } from './room.store.js';

@Module({
  providers: [RoomGateway, RoomStore],
  exports: [RoomStore],
})
export class RoomModule {}
