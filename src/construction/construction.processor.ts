import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { BuildingType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FinishBuildPayload } from './construction.service';
import { BUILDING_PRODUCTION_INCREASES } from 'src/game/constants/building.constants';

@Processor('construction')
@Injectable()
export class ConstructionProcessor {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finaliza um upgrade de construção:
   * - Sobe nível
   * - Marca task como completed
   * - Atualiza produção de recursos (se aplicável)
   */
  async finishBuilding(
    villageId: string,
    buildingId: string,
    type: BuildingType,
    targetLevel: number,
  ) {
    console.log(
      `[finishBuilding] ${type} → nível ${targetLevel} (village ${villageId})`,
    );

    // Atualizar building
    await this.prisma.building.update({
      where: { id: buildingId },
      data: { level: targetLevel, status: 'idle', queuedUntil: null },
    });

    // Marcar tasks como completed
    await this.prisma.constructionTask.updateMany({
      where: { villageId, buildingId, status: 'in_progress' },
      data: { status: 'completed' },
    });

    // Atualizar produção se for recurso
    const increment = this.getProductionIncrease(type, targetLevel);
    if (increment) {
      const village = await this.prisma.village.findUnique({
        where: { id: villageId },
        select: {
          foodProductionRate: true,
          woodProductionRate: true,
          stoneProductionRate: true,
          goldProductionRate: true,
        },
      });
      if (!village) return;

      const updateData: any = {};
      updateData[`${increment.resource}ProductionRate`] = village[`${increment.resource}ProductionRate`] + increment.amount;

      await this.prisma.village.update({
        where: { id: villageId },
        data: updateData,
      });

      console.log(
        `[finishBuilding] Produção de ${increment.resource} +${increment.amount}`,
      );
    }
  }

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

  @Process('finishBuild')
  async handleFinishBuild(job: Job<FinishBuildPayload>) {
    console.log('🚧 [ConstructionProcessor] Job received:', job.data);
    const { villageId, buildingId, type, targetLevel } = job.data;

    const existing = await this.prisma.building.findUnique({
      where: { id: buildingId },
    });
    if (!existing) {
      console.error(`Building with id ${buildingId} not found.`);
      return;
    }

    await this.prisma.building.update({
      where: { id: buildingId },
      data: { level: targetLevel, status: 'idle', queuedUntil: null },
    });

    await this.prisma.constructionTask.updateMany({
      where: { villageId, buildingId, status: 'in_progress' },
      data: { status: 'completed' },
    });

    const increment = this.getProductionIncrease(type, targetLevel);
    if (increment) {
      const village = await this.prisma.village.findUnique({
        where: { id: villageId },
        select: {
          foodProductionRate: true,
          woodProductionRate: true,
          stoneProductionRate: true,
          goldProductionRate: true,
        },
      });
      if (!village) return;

      const updateData: any = {};
      updateData[`${increment.resource}ProductionRate`] = village[`${increment.resource}ProductionRate`] + increment.amount;

      await this.prisma.village.update({
        where: { id: villageId },
        data: updateData,
      });
    }
  }
 
}

