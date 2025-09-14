import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';

import { Queue } from 'bullmq';

@Injectable()
export class TrainingQueueService {
  private readonly logger = new Logger(TrainingQueueService.name);

  constructor(@InjectQueue('training') private readonly trainingQueue: Queue) {}

  async queueTraining(taskId: string, delayMs: number) {
    this.logger.log(`[Queue] Enqueuing task ${taskId} (delay: ${delayMs}ms)`);

    return this.trainingQueue.add(
      'train',
      { taskId },
      { delay: delayMs, removeOnComplete: true, removeOnFail: false },
    );
  }
}
