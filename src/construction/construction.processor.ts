import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { BuildingType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FinishBuildPayload } from './construction.service';
import { BUILDING_PRODUCTION_INCREASES } from 'src/game/constants/building.constants';
import { SocketGateway } from 'src/socket/socket.gateway';

@Processor('construction')
@Injectable()
export class ConstructionProcessor {
  private readonly logger = new Logger(ConstructionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly socket: SocketGateway,
  ) {}

  /**
   * Bull job handler for construction completion.
   */
  @Process('finishBuild')
  async handleFinishBuild(job: Job<FinishBuildPayload>) {
    this.logger.log(`[handleFinishBuild] Processing job ${job.id}:`, job.data);
    const { villageId, buildingId, type, targetLevel } = job.data;

    await this.finishBuilding(villageId, buildingId, type, targetLevel);
  }

  /**
   * Complete a building upgrade.
   * Can be called directly (for catch-up) or via job processor.
   */
  async finishBuilding(
    villageId: string,
    buildingId: string,
    type: BuildingType,
    targetLevel: number,
  ): Promise<void> {
    this.logger.log(
      `[finishBuilding] ${type} -> level ${targetLevel} (village ${villageId})`,
    );

    // Use transaction to ensure atomicity
    await this.prisma.$transaction(async (tx) => {
      // Check building exists
      const existing = await tx.building.findUnique({
        where: { id: buildingId },
      });

      if (!existing) {
        this.logger.error(`Building ${buildingId} not found, skipping`);
        return;
      }

      // Skip if already at target level (idempotency)
      if (existing.level >= targetLevel) {
        this.logger.warn(
          `Building ${buildingId} already at level ${existing.level}, skipping`,
        );
        return;
      }

      // Update building level and status
      const updatedBuilding = await tx.building.update({
        where: { id: buildingId },
        data: {
          level: targetLevel,
          status: 'idle',
          queuedUntil: null,
        },
      });

      // Mark construction tasks as completed
      await tx.constructionTask.updateMany({
        where: {
          villageId,
          buildingId,
          status: 'in_progress',
        },
        data: { status: 'completed' },
      });

      // Update production rates if applicable
      const increment = this.getProductionIncrease(type, targetLevel);
      if (increment) {
        // Use atomic increment instead of read-then-write
        const updateField = `${increment.resource}ProductionRate` as const;

        await tx.village.update({
          where: { id: villageId },
          data: {
            [updateField]: { increment: increment.amount },
          },
        });

        this.logger.log(
          `[finishBuilding] Production +${increment.amount} ${increment.resource}`,
        );
      }

      // Notify clients via socket
      this.socket.sendConstructionUpdate(villageId, updatedBuilding);
    });
  }

  /**
   * Calculate production increase for resource buildings.
   */
  private getProductionIncrease(
    type: BuildingType,
    level: number,
  ): { resource: 'food' | 'wood' | 'stone' | 'gold'; amount: number } | null {
    const resourceMap: Partial<
      Record<BuildingType, 'food' | 'wood' | 'stone' | 'gold'>
    > = {
      [BuildingType.SAWMILL]: 'wood',
      [BuildingType.CLAY_PIT]: 'stone',
      [BuildingType.IRON_MINE]: 'stone',
      [BuildingType.FARM]: 'food',
    };

    const resource = resourceMap[type];
    if (!resource) return null;

    const levels = (BUILDING_PRODUCTION_INCREASES as any)[type] ?? [];
    const amount = levels[level - 1] ?? 0;

    return amount > 0 ? { resource, amount } : null;
  }
}
