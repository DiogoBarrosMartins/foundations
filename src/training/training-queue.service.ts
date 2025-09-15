import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class TrainingQueueService {
  constructor(@InjectQueue('training') private readonly trainingQueue: Queue) {}
  
  async queueTraining(taskId: string, unitTimeMs: number) {
    return this.trainingQueue.add(
      'processTraining',
      { taskId, unitTimeMs },
      {
        delay: unitTimeMs,
        attempts: 3,
        backoff: 1000,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
  async removeJob(jobId: string) {
    const job = await this.trainingQueue.getJob(jobId);
    if (job) await job.remove();
  }
}
