import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrainingService } from './training.service';
import { TROOP_TYPES } from '../game/constants/troop.constants';

@Processor('training')
@Injectable()
export class TrainingProcessor {
  private readonly logger = new Logger(TrainingProcessor.name);

  constructor(
    private prisma: PrismaService,
    private trainingService: TrainingService,
  ) {
    this.logger.log('✅ TrainingProcessor inicializado');
  }
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

    // 🔎 Garante que a task tem tempos definidos
    if (!task.startTime || !task.endTime) {
      this.logger.warn(
        `Task ${taskId} ainda não tem startTime/endTime — corrigindo agora`,
      );

      const def = TROOP_TYPES[task.troopType];
      if (!def) {
        this.logger.error(`Troop definition não encontrada: ${task.troopType}`);
        return;
      }

      const unitTimeMs = def.buildTime * 1000;
      const endTime = new Date(Date.now() + unitTimeMs * task.count);

      await this.prisma.trainingTask.update({
        where: { id: task.id },
        data: {
          startTime: new Date(),
          endTime,
        },
      });

      // agenda novamente e sai
      await job.queue.add('processTraining', { taskId }, { delay: unitTimeMs });
      return;
    }

    // calcula tempo por unidade
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

      await job.queue.add('processTraining', { taskId }, { delay: unitTimeMs });

      this.logger.log(`⏳ Task ${task.id}: faltam ${newRemaining} unidades`);
    } else {
      await this.prisma.trainingTask.update({
        where: { id: task.id },
        data: { status: 'completed', remaining: 0, endTime: new Date() },
      });

      this.logger.log(`🏁 Task ${task.id} concluída!`);

      // ativa próxima task pendente
      await this.trainingService.triggerNextTaskIfAvailable(task.villageId);
    }
  }

}
