import { Module } from '@nestjs/common';
import { RoomStore } from './room.store.js';
import { RoomsController } from './rooms.controller.js';

@Module({
  controllers: [RoomsController],
  providers: [RoomStore],
  exports: [RoomStore],
})
export class RoomModule {}
