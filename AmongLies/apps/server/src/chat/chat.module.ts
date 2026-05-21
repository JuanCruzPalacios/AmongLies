import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway.js';
import { RoomModule } from '../room/room.module.js';

@Module({
  imports: [RoomModule],
  providers: [ChatGateway],
})
export class ChatModule {}
