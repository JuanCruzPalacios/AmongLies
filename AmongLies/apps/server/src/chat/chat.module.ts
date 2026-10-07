import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway.js';
import { RoomModule } from '../room/room.module.js';
import { GameModule } from '../game/game.module.js';

@Module({
  imports: [RoomModule, GameModule],
  providers: [ChatGateway],
})
export class ChatModule {}
