import { Global, Module } from '@nestjs/common';
import { AccountService } from './account.service.js';
import { ModerationService } from './moderation.service.js';

/** Global: salas, workshop y social consultan si una cuenta está suspendida o es admin. */
@Global()
@Module({
  providers: [AccountService, ModerationService],
  exports: [AccountService, ModerationService],
})
export class ModerationModule {}
