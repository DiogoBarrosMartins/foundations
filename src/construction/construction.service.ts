import { Injectable, Logger } from '@nestjs/common';
import { BuildingType } from '@prisma/client';

export interface FinishBuildPayload {
  villageId: string;
  buildingId: string;
  type: BuildingType;
  targetLevel: number;
}

@Injectable()
export class ConstructionService {
  private readonly logger = new Logger(ConstructionService.name);

  async queueBuild(
    villageId: string,
    buildingId: string,
    type: BuildingType,
    currentLevel: number,
    buildTimeMs: number,
  ): Promise<void> {
    const targetLevel = currentLevel + 1;

    // Fake: sem Redis/Bull, só loga
    this.logger.warn(
      `[queueBuild] Ignorado no Render → ${type} vai para nível ${targetLevel} em ${buildTimeMs}ms`,
    );
  }
}
