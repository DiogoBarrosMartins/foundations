import { Module } from '@nestjs/common';
import { CombatService } from './combat.service';
import { CombatQueueService } from './combat.queue.service';
import { CombatProcessor } from './combat.processor';
import { PrismaService } from 'src/prisma/prisma.service';
import { BullModule } from '@nestjs/bull';
import { CombatController } from './combat.controller';
import { SocketGateway } from 'src/socket/socket.gateway';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'combat',
    }),
  ],
  controllers: [CombatController],
  providers: [
    PrismaService,
    CombatService,
    CombatQueueService,
    CombatProcessor,
    SocketGateway,
  ],
  exports: [CombatService],
})
export class CombatModule {}
