import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CombatService } from './combat.service';
import { CombatQueueService } from './combat.queue.service';
import { CombatProcessor } from './combat.processor';
import { CombatController } from './combat.controller';
import { SocketModule } from 'src/socket/socket.module';

@Module({
  imports: [
    SocketModule,
    BullModule.registerQueue({
      name: 'combat',
    }),
  ],
  controllers: [CombatController],
  providers: [
    CombatService,
    CombatQueueService,
    CombatProcessor,
  ],
  exports: [CombatService],
})
export class CombatModule {}
