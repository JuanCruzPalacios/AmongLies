import { Global, Module } from '@nestjs/common';
import { PlayerService } from './player.service.js';

@Global()
@Module({
  providers: [PlayerService],
  exports: [PlayerService],
})
export class PlayerModule {}
