import { Module } from '@nestjs/common';
import { TrainingService } from './training.service';
import { TrainingProcessor } from './training.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { TrainingQueueService } from './training-queue.service';

import { ResourceModule } from '../resource/resource.module';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    PrismaModule,
    ResourceModule,
     BullModule.registerQueue({
      name: 'training', // <-- obrigatório para @InjectQueue('training')
    }),
  ],
  providers: [TrainingService, TrainingQueueService, TrainingProcessor],
  exports: [TrainingService],
})
export class TrainingModule {}
