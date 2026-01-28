import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, Job } from 'bull';

export interface ResolveBattlePayload {
  battleId: string;
}

@Injectable()
export class CombatQueueService {
  private readonly logger = new Logger(CombatQueueService.name);

  constructor(
    @InjectQueue('combat')
    private readonly combatQueue: Queue,
  ) {}

  async queueBattleResolution(
    payload: ResolveBattlePayload,
    delayMs: number,
  ): Promise<Job> {
    // Generate unique job ID to prevent duplicate battle resolutions
    const jobId = `battle:${payload.battleId}`;

    // Check if job already exists
    const existingJob = await this.combatQueue.getJob(jobId);
    if (existingJob) {
      this.logger.warn(`[queueBattleResolution] Battle ${payload.battleId} already queued`);
      return existingJob;
    }

    const job = await this.combatQueue.add('resolveBattle', payload, {
      jobId,
      delay: delayMs,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      // Keep completed battles for 24 hours for reporting
      removeOnComplete: {
        age: 86400,
        count: 500,
      },
      // Keep failed battles for 7 days for investigation
      removeOnFail: {
        age: 604800,
        count: 100,
      },
    });

    this.logger.log(
      `[queueBattleResolution] Battle ${payload.battleId} queued, resolves in ${delayMs}ms`,
    );

    return job;
  }

  /**
   * Cancel a pending battle resolution.
   */
  async cancelBattle(battleId: string): Promise<boolean> {
    const jobId = `battle:${battleId}`;
    const job = await this.combatQueue.getJob(jobId);

    if (job) {
      const state = await job.getState();
      if (state === 'waiting' || state === 'delayed') {
        await job.remove();
        this.logger.log(`[cancelBattle] Battle ${battleId} cancelled`);
        return true;
      }
    }

    return false;
  }

  /**
   * Get battle job status.
   */
  async getBattleStatus(battleId: string): Promise<string | null> {
    const jobId = `battle:${battleId}`;
    const job = await this.combatQueue.getJob(jobId);

    if (job) {
      return job.getState();
    }

    return null;
  }
}
