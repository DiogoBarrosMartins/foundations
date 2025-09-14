import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';   // <-- agora do bull normal
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Processor('training')
@Injectable()
export class TrainingProcessor {
  private readonly logger = new Logger(TrainingProcessor.name);

  constructor(private prisma: PrismaService) {}

  @Process()
  async handle(job: Job<{ taskId: string }>): Promise<void> {
    const { taskId } = job.data;
    this.logger.log(`⚔️ Processing training task ${taskId}`);

    const task = await this.prisma.trainingTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      this.logger.warn(`[Processor] Task ${taskId} not found`);
      return;
    }

    if (task.status === 'completed') {
      this.logger.warn(`[Processor] Task ${taskId} was already completed`);
      return;
    }

    await this.prisma.troop.upsert({
      where: {
        villageId_troopType_status: {
          villageId: task.villageId,
          troopType: task.troopType,
          status: 'idle',
        },
      },
      update: { quantity: { increment: task.count } },
      create: {
        villageId: task.villageId,
        troopType: task.troopType,
        quantity: task.count,
        status: 'idle',
      },
    });

    await this.prisma.trainingTask.update({
      where: { id: taskId },
      data: { status: 'completed', remaining: 0 },
    });

    this.logger.log(
      `✅ Training completed: ${task.count} ${task.troopType} added to village ${task.villageId}`,
    );
  }
}
