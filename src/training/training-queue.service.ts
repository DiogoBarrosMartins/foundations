import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, Job } from 'bull';

@Injectable()
export class TrainingQueueService {
  private readonly logger = new Logger(TrainingQueueService.name);

  constructor(@InjectQueue('training') private readonly trainingQueue: Queue) {}

  async queueTraining(taskId: string, unitTimeMs: number): Promise<Job | null> {
    // Generate unique job ID to prevent duplicate jobs
    const jobId = `train:${taskId}:${Date.now()}`;

    // Check if a job for this task already exists and is waiting
    const existingJobs = await this.trainingQueue.getJobs(['waiting', 'delayed']);
    const hasExisting = existingJobs.some(
      (job) => job.data.taskId === taskId && job.id !== jobId,
    );

    if (hasExisting) {
      this.logger.warn(`[queueTraining] Task ${taskId} already has a pending job`);
      return null;
    }

    const job = await this.trainingQueue.add(
      'processTraining',
      { taskId, unitTimeMs },
      {
        jobId,
        delay: unitTimeMs,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        // Keep completed jobs for 1 hour
        removeOnComplete: {
          age: 3600,
          count: 200,
        },
        // Keep failed jobs for 24 hours
        removeOnFail: {
          age: 86400,
          count: 100,
        },
      },
    );

    this.logger.log(`[queueTraining] Job ${jobId} queued for task ${taskId}`);
    return job;
  }

  async removeJob(jobId: string): Promise<boolean> {
    const job = await this.trainingQueue.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`[removeJob] Job ${jobId} removed`);
      return true;
    }
    return false;
  }

  /**
   * Remove all pending jobs for a specific training task.
   */
  async removeTaskJobs(taskId: string): Promise<number> {
    const jobs = await this.trainingQueue.getJobs(['waiting', 'delayed']);
    let removed = 0;

    for (const job of jobs) {
      if (job.data.taskId === taskId) {
        await job.remove();
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.log(`[removeTaskJobs] Removed ${removed} jobs for task ${taskId}`);
    }

    return removed;
  }
}
