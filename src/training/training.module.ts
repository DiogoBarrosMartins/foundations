import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TrainingService } from './training.service';
import { TrainingProcessor } from './training.processor';
import { TrainingQueueService } from './training-queue.service';
import { ResourceModule } from '../resource/resource.module';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [
    ResourceModule,
    SocketModule,
    BullModule.registerQueue({
      name: 'training',
    }),
  ],
  providers: [TrainingService, TrainingQueueService, TrainingProcessor],
  exports: [TrainingService],
})
export class TrainingModule {}
