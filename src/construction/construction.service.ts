import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { BuildingType } from '@prisma/client';
import type { Queue } from 'bull';

export interface FinishBuildPayload {
  villageId: string;
  buildingId: string;
  type: BuildingType;
  targetLevel: number;
}

@Injectable()
export class ConstructionService {
  private readonly logger = new Logger(ConstructionService.name);

  constructor(
    @InjectQueue('construction') private readonly constructionQueue: Queue,
  ) {}

  async queueBuild(
    villageId: string,
    buildingId: string,
    type: BuildingType,
    currentLevel: number,
    buildTimeMs: number,
  ): Promise<void> {
    const targetLevel = currentLevel + 1;

    // Generate unique job ID to prevent duplicate jobs
    const jobId = `build:${buildingId}:${targetLevel}`;

    // Check if job already exists
    const existingJob = await this.constructionQueue.getJob(jobId);
    if (existingJob) {
      this.logger.warn(`[queueBuild] Job ${jobId} already exists, skipping`);
      return;
    }

    await this.constructionQueue.add(
      'finishBuild',
      { villageId, buildingId, type, targetLevel } as FinishBuildPayload,
      {
        jobId,
        delay: buildTimeMs,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2s, then 4s, 8s, 16s, 32s
        },
        // Keep completed jobs for 1 hour for debugging, then auto-remove
        removeOnComplete: {
          age: 3600, // 1 hour in seconds
          count: 100, // Keep max 100 completed jobs
        },
        // Keep failed jobs for 24 hours, then auto-remove
        removeOnFail: {
          age: 86400, // 24 hours in seconds
          count: 50, // Keep max 50 failed jobs
        },
      },
    );

    this.logger.log(
      `[queueBuild] Job ${jobId} queued: ${type} level ${targetLevel} in ${buildTimeMs}ms`,
    );
  }

  /**
   * Cancel a pending construction job.
   */
  async cancelBuild(buildingId: string, targetLevel: number): Promise<boolean> {
    const jobId = `build:${buildingId}:${targetLevel}`;
    const job = await this.constructionQueue.getJob(jobId);

    if (job) {
      await job.remove();
      this.logger.log(`[cancelBuild] Job ${jobId} cancelled`);
      return true;
    }

    return false;
  }
}
