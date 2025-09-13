import { Injectable } from '@nestjs/common';
import { ResourceService } from '../resource/resource.service';
import { TrainingService } from '../training/training.service';
import { TROOP_TYPES } from 'src/game/constants/troop.constants';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TroopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resourceService: ResourceService,
    private readonly trainingService: TrainingService,
  ) {}

  async trainTroops(villageId: string, troopType: string, count: number) {
    const def = TROOP_TYPES[troopType];
    if (!def) throw new Error(`Troop type "${troopType}" invalid`);

    const troop = await this.prisma.troop.upsert({
      where: { id: `${villageId}-${troopType}-idle` },
      create: {
        villageId,
        troopType,
        quantity: 0,
        status: 'idle',
      },
      update: {},
    });

    const totalCost = {
      food: def.cost.food * count,
      wood: def.cost.wood * count,
      stone: def.cost.stone * count,
      gold: def.cost.gold * count,
    };

    await this.resourceService.deductResources(villageId, totalCost);

    const unitTimeMs = def.buildTime * 1000;

    return this.trainingService.startTraining(
      villageId,
      troop.id,
      troopType,
      def.buildingType,
      count,
      unitTimeMs,
    );
  }
}
