import { Module } from '@nestjs/common';
import { RoomModule } from '../room/room.module.js';
import {
  FRIENDSHIP_REPOSITORY,
  SupabaseFriendshipRepository,
} from './friendship.repository.js';
import { SocialGateway } from './social.gateway.js';
import { SocialService } from './social.service.js';

@Module({
  imports: [RoomModule],
  providers: [
    SocialGateway,
    SocialService,
    { provide: FRIENDSHIP_REPOSITORY, useClass: SupabaseFriendshipRepository },
  ],
  exports: [SocialGateway],
})
export class SocialModule {}
