import { Injectable, NotFoundException } from '@nestjs/common';
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

  async getTroopDefinitions(villageId: string) {
    const village = await this.prisma.village.findUnique({
      where: { id: villageId },
      include: { buildings: true },
    });
    if (!village) throw new NotFoundException('Village not found');

    const race = village.race; // HUMAN | ORC | ELF | DWARF | UNDEAD
    const buildings = village.buildings;

    // filtra tropas pela raça
    const troops = Object.values(TROOP_TYPES).filter(
      (t) => t.race === race,
    );

    // marca se estão desbloqueadas
    const result = troops.map((t) => {
      const building = buildings.find((b) => b.type === t.buildingType);
      const unlocked = !!building && building.level >= t.requiredLevel;

      return {
        id: t.id,             // ex: "human_swordsman"
        name: t.name,         // ex: "Swordsman"
        type: t.type,         // ex: "Infantry"
        tier: t.tier,
        buildingType: t.buildingType,
        requiredLevel: t.requiredLevel,
        unlocked,
      };
    });

    return { troops: result };
  }

  async trainTroops(villageId: string, troopType: string, count: number) {
    const def = TROOP_TYPES[troopType];
    if (!def) throw new Error(`Troop type "${troopType}" invalid`);

    // Usa a unique key composta em vez de id manual
    const troop = await this.prisma.troop.upsert({
      where: {
        villageId_troopType_status: {
          villageId,
          troopType,
          status: 'idle',
        },
      },
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
