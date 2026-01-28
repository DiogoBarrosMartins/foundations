import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrainingService } from './training.service';
import { TrainingQueueService } from './training-queue.service';
import { TROOP_TYPES } from '../game/constants/troop.constants';
import { SocketGateway } from '../socket/socket.gateway';

@Processor('training')
@Injectable()
export class TrainingProcessor {
  private readonly logger = new Logger(TrainingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trainingService: TrainingService,
    private readonly trainingQueue: TrainingQueueService,
    private readonly socket: SocketGateway,
  ) {
    this.logger.log('TrainingProcessor initialized');
  }

  @Process('processTraining')
  async handleProcessTraining(job: Job<{ taskId: string; unitTimeMs?: number }>) {
    const { taskId } = job.data;

    this.logger.log(`[processTraining] Processing job ${job.id} for task ${taskId}`);

    // Use transaction to prevent race conditions
    const result = await this.prisma.$transaction(async (tx) => {
      // Lock and fetch task
      const task = await tx.trainingTask.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        this.logger.warn(`Task ${taskId} not found, job may have been cancelled`);
        return { action: 'skip', reason: 'not_found' };
      }

      // Idempotency check - already completed
      if (task.status === 'completed' || task.remaining <= 0) {
        this.logger.log(`Task ${taskId} already completed, skipping`);
        return { action: 'skip', reason: 'already_completed' };
      }

      // Validate task has timing info
      if (!task.startTime || !task.endTime) {
        this.logger.warn(`Task ${taskId} missing timing, initializing`);

        const def = TROOP_TYPES[task.troopType];
        if (!def) {
          this.logger.error(`Unknown troop type: ${task.troopType}`);
          return { action: 'error', reason: 'unknown_troop_type' };
        }

        const unitTimeMs = def.buildTime * 1000;
        const endTime = new Date(Date.now() + unitTimeMs * task.count);

        await tx.trainingTask.update({
          where: { id: task.id },
          data: {
            startTime: new Date(),
            endTime,
            status: 'in_progress',
          },
        });

        return {
          action: 'reschedule',
          unitTimeMs,
          villageId: task.villageId,
        };
      }

      // Calculate time per unit
      const unitTimeMs =
        (task.endTime.getTime() - task.startTime.getTime()) / task.count;

      // Atomically increment troop quantity
      await tx.troop.update({
        where: { id: task.troopId },
        data: { quantity: { increment: 1 } },
      });

      const newRemaining = task.remaining - 1;

      if (newRemaining > 0) {
        // Update remaining count
        const updatedTask = await tx.trainingTask.update({
          where: { id: task.id },
          data: { remaining: newRemaining },
        });

        return {
          action: 'continue',
          unitTimeMs,
          remaining: newRemaining,
          villageId: task.villageId,
          task: updatedTask,
        };
      } else {
        // Training complete
        const completedTask = await tx.trainingTask.update({
          where: { id: task.id },
          data: {
            status: 'completed',
            remaining: 0,
            endTime: new Date(),
          },
        });

        return {
          action: 'complete',
          villageId: task.villageId,
          task: completedTask,
        };
      }
    });

    // Handle result outside transaction
    switch (result.action) {
      case 'skip':
        // Nothing to do
        break;

      case 'error':
        throw new Error(`Training error: ${result.reason}`);

      case 'reschedule':
        // Schedule initial training job
        await this.trainingQueue.queueTraining(taskId, result.unitTimeMs!);
        break;

      case 'continue':
        // Schedule next unit training
        await this.trainingQueue.queueTraining(taskId, result.unitTimeMs!);

        // Notify clients
        this.socket.sendTrainingUpdate(result.villageId!, result.task);

        this.logger.log(
          `[processTraining] Task ${taskId}: ${result.remaining} units remaining`,
        );
        break;

      case 'complete':
        // Notify clients
        this.socket.sendTrainingUpdate(result.villageId!, result.task);

        this.logger.log(`[processTraining] Task ${taskId} completed!`);

        // Trigger next pending task
        await this.trainingService.triggerNextTaskIfAvailable(result.villageId!);
        break;
    }
  }
}
