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

    await this.constructionQueue.add(
      'finishBuild',
      { villageId, buildingId, type, targetLevel } as FinishBuildPayload,
      { delay: buildTimeMs, attempts: 3, backoff: 1000 });
    this.logger.warn(
      `[queueBuild] Ignorado no Render → ${type} vai para nível ${targetLevel} em ${buildTimeMs}ms`,
    );
  }
}
