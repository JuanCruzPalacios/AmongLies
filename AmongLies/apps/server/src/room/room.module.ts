import { Module } from '@nestjs/common';
import { RoomStore } from './room.store.js';

@Module({
  providers: [RoomStore],
  exports: [RoomStore],
})
export class RoomModule {}
