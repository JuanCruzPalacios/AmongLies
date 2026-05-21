import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway.js';
import { GameService } from './game.service.js';
import { RoomModule } from '../room/room.module.js';

@Module({
  imports: [RoomModule],
  providers: [GameGateway, GameService],
  exports: [GameService],
})
export class GameModule {}
