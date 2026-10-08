import { Module } from '@nestjs/common';
import { WorkshopGateway } from './workshop.gateway.js';
import { WorkshopService } from './workshop.service.js';
import {
  SupabaseWorkshopRepository,
  WORKSHOP_REPOSITORY,
} from './workshop.repository.js';

@Module({
  providers: [
    WorkshopGateway,
    WorkshopService,
    { provide: WORKSHOP_REPOSITORY, useClass: SupabaseWorkshopRepository },
  ],
  exports: [WorkshopService],
})
export class WorkshopModule {}
