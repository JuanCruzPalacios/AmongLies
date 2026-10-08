import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway.js';
import { GameService } from './game.service.js';
import { RoomModule } from '../room/room.module.js';
import { RoomGateway } from '../room/room.gateway.js';
import { AuthService } from '../auth/auth.service.js';
import { StatsService } from '../stats/stats.service.js';
import { SocialModule } from '../social/social.module.js';
import { WorkshopModule } from '../workshop/workshop.module.js';

/** Salas y juego van juntos: la conexión de un jugador afecta a la partida en curso. */
@Module({
  imports: [RoomModule, SocialModule, WorkshopModule],
  providers: [GameGateway, GameService, RoomGateway, AuthService, StatsService],
  exports: [GameService],
})
export class GameModule {}
