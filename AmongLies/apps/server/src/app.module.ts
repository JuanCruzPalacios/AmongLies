import { Module } from '@nestjs/common';
import { RoomModule } from './room/room.module.js';
import { ChatModule } from './chat/chat.module.js';
import { GameModule } from './game/game.module.js';
import { PlayerModule } from './player/player.module.js';
import { HealthController } from './health.controller.js';
import { ModerationModule } from './moderation/moderation.module.js';

@Module({
  imports: [ModerationModule, RoomModule, ChatModule, GameModule, PlayerModule],
  controllers: [HealthController],
})
export class AppModule {}
