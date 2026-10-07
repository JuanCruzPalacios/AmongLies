import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway.js';
import { GameService } from './game.service.js';
import { RoomModule } from '../room/room.module.js';
import { RoomGateway } from '../room/room.gateway.js';
import { AuthService } from '../auth/auth.service.js';

/** Salas y juego van juntos: la conexión de un jugador afecta a la partida en curso. */
@Module({
  imports: [RoomModule],
  providers: [GameGateway, GameService, RoomGateway, AuthService],
  exports: [GameService],
})
export class GameModule {}
