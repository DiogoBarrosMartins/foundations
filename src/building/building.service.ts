import { BadRequestException, Injectable } from '@nestjs/common';
import { BuildingType, RaceName } from '@prisma/client';
import { ConstructionService } from '../construction/construction.service';
import { ResourceService } from '../resource/resource.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BUILDING_COSTS,
  BUILDING_NAMES,
  BUILD_TIMES_MS
} from 'src/game/constants/building.constants';

@Injectable()
export class BuildingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resourceService: ResourceService,
    private readonly constructionService: ConstructionService,
  ) {}

  /**
   * Initialize all buildings for a new village
   */
 async initializeBuildingsForVillage(villageId: string, race: RaceName) {
  if (!BUILDING_NAMES[race]) {
    throw new BadRequestException(
      `Invalid race "${race}" passed to initializeBuildingsForVillage`,
    );
  }

  const buildingTypes = Object.values(BuildingType);

  const buildings = buildingTypes.map((type) => {
    const buildingName = BUILDING_NAMES[race][type];
    if (!buildingName) {
      throw new BadRequestException(
        `No building name defined for race ${race}, type ${type}`,
      );
    }

    return {
      villageId,
      type,
      level: 0,
      status: 'idle',
      name: buildingName,
    };
  });

  await this.prisma.building.createMany({ data: buildings });
}


  /**
   * Upgrade a building
   */
  async upgradeBuilding(villageId: string, type: BuildingType) {
    const existing = await this.prisma.building.findFirst({
      where: { villageId, type },
    });

    if (!existing) {
      throw new BadRequestException(
        `Building ${type} not found in village ${villageId}`,
      );
    }

    const currentLevel = existing.level;

    const costs = BUILDING_COSTS[type];
    const times = BUILD_TIMES_MS[type];
    if (!costs || !times) {
      throw new BadRequestException(`No cost/time config for building ${type}`);
    }

    if (currentLevel >= costs.length) {
      throw new BadRequestException(
        `Building ${type} is already at max level (${currentLevel})`,
      );
    }

    const costDef = costs[currentLevel];
    const buildTimeMs = times[currentLevel];
    const finishAt = new Date(Date.now() + buildTimeMs);

    await this.resourceService.deductResources(villageId, {
      food: costDef.food,
      wood: costDef.wood,
      stone: costDef.stone,
      gold: costDef.gold,
    });

    await this.constructionService.queueBuild(
      villageId,
      existing.id,
      type,
      currentLevel,
      buildTimeMs,
    );

    await this.prisma.constructionTask.create({
      data: {
        villageId,
        buildingId: existing.id,
        type,
        level: currentLevel + 1,
        status: 'in_progress',
        startTime: new Date(),
        endTime: finishAt,
      },
    });

    await this.prisma.building.update({
      where: { id: existing.id },
      data: { status: 'queued', queuedUntil: finishAt },
    });

    return { buildingId: existing.id, finishAt };
  }
}
