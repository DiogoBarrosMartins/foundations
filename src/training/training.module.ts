import { Module } from '@nestjs/common';
import { TrainingService } from './training.service';
import { TrainingProcessor } from './training.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { TrainingQueueService } from './training-queue.service';

import { ResourceModule } from '../resource/resource.module';

@Module({
  imports: [
    PrismaModule,
    ResourceModule,
  ],
  providers: [TrainingService, TrainingQueueService, TrainingProcessor],
  exports: [TrainingService],
})
export class TrainingModule {}
