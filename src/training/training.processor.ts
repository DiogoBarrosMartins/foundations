import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TrainingService } from './training.service';

@Processor('training')
@Injectable()
export class TrainingProcessor {
  private readonly logger = new Logger(TrainingProcessor.name);

  constructor(
    private prisma: PrismaService,
    private trainingService: TrainingService,
  ) {}

  @Process('processTraining')
  async handleProcessTraining(job: Job<{ taskId: string }>) {
    const { taskId } = job.data;

    const task = await this.prisma.trainingTask.findUnique({
      where: { id: taskId },
    });
    if (!task) return;

    if (task.remaining <= 0) {
      this.logger.log(`Task ${taskId} já concluída`);
      return;
    }

    // calcula unitTimeMs dinamicamente
    const unitTimeMs =
      (task.endTime.getTime() - task.startTime.getTime()) / task.count;

    // adiciona 1 tropa
    await this.prisma.troop.update({
      where: { id: task.troopId },
      data: { quantity: { increment: 1 } },
    });

    const newRemaining = task.remaining - 1;

    if (newRemaining > 0) {
      await this.prisma.trainingTask.update({
        where: { id: task.id },
        data: { remaining: newRemaining },
      });

      // agenda próximo tick
      await job.queue.add(
        'processTraining',
        { taskId },
        { delay: unitTimeMs },
      );

      this.logger.log(
        `⏳ Task ${task.id}: faltam ${newRemaining} unidades`,
      );
    } else {
      await this.prisma.trainingTask.update({
        where: { id: task.id },
        data: { status: 'completed', remaining: 0, endTime: new Date() },
      });
      this.logger.log(`🏁 Task ${task.id} concluída!`);

      await this.trainingService.triggerNextTaskIfAvailable(task.villageId);
    }
  }
}
