import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TrainingService } from './training.service';
import { TrainingProcessor } from './training.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { TrainingQueueService } from './training-queue.service';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'training',
    }),
  ],
  providers: [TrainingService, TrainingQueueService, TrainingProcessor],
  exports: [TrainingService],
})
export class TrainingModule {}
