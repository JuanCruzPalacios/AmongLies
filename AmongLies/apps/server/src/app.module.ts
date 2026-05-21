import { Module } from '@nestjs/common';
import { RoomModule } from './room/room.module.js';
import { ChatModule } from './chat/chat.module.js';
import { GameModule } from './game/game.module.js';
import { PlayerModule } from './player/player.module.js';

@Module({
  imports: [RoomModule, ChatModule, GameModule, PlayerModule],
})
export class AppModule {}
