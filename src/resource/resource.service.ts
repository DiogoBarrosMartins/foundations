import { BadRequestException, Injectable } from '@nestjs/common';
import { SocketGateway } from '../socket/socket.gateway';
import { PrismaService } from 'src/prisma/prisma.service';
import { Resources } from 'src/game/constants/resource.constants';

@Injectable()
export class ResourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socket: SocketGateway,
  ) {}

  async getResources(villageId: string): Promise<Resources> {
    const village = await this.prisma.village.findUniqueOrThrow({
      where: { id: villageId },
      select: {
        foodAmount: true,
        woodAmount: true,
        stoneAmount: true,
        goldAmount: true,
        foodProductionRate: true,
        woodProductionRate: true,
        stoneProductionRate: true,
        goldProductionRate: true,
        lastCollectedAt: true,
        createdAt: true,
      },
    });

    const amounts: Resources = {
      food: village.foodAmount,
      wood: village.woodAmount,
      stone: village.stoneAmount,
      gold: village.goldAmount,
    };
    const rates: Resources = {
      food: village.foodProductionRate,
      wood: village.woodProductionRate,
      stone: village.stoneProductionRate,
      gold: village.goldProductionRate,
    };

    const now = new Date();
    const last = village.lastCollectedAt;
    const elapsedSec = Math.floor((now.getTime() - last.getTime()) / 1000);

    const newResources: Resources = {
      food: amounts.food + elapsedSec * rates.food,
      wood: amounts.wood + elapsedSec * rates.wood,
      stone: amounts.stone + elapsedSec * rates.stone,
      gold: amounts.gold + elapsedSec * rates.gold,
    };

    await this.prisma.village.update({
      where: { id: villageId },
      data: {
        foodAmount: newResources.food,
        woodAmount: newResources.wood,
        stoneAmount: newResources.stone,
        goldAmount: newResources.gold,
        lastCollectedAt: now,
      },
    });

    this.socket.sendResourcesUpdate(villageId, newResources);

    return newResources;
  }

  async deductResources(villageId: string, cost: Resources): Promise<void> {
    const resources = await this.getResources(villageId);

    for (const key of ['food', 'wood', 'stone', 'gold'] as const) {
      if (resources[key] < cost[key]) {
        throw new BadRequestException(
          `Insufficient resources: need ${cost[key]} ${key}, but have only ${resources[key]}.`,
        );
      }
    }

    const updated: Resources = {
      food: Math.max(resources.food - cost.food, 0),
      wood: Math.max(resources.wood - cost.wood, 0),
      stone: Math.max(resources.stone - cost.stone, 0),
      gold: Math.max(resources.gold - cost.gold, 0),
    };

    await this.prisma.village.update({
      where: { id: villageId },
      data: {
        foodAmount: updated.food,
        woodAmount: updated.wood,
        stoneAmount: updated.stone,
        goldAmount: updated.gold,
      },
    });

    this.socket.sendResourcesUpdate(villageId, updated);
  }

  /**
   * Adiciona recursos à aldeia (usado em reembolsos, recompensas, etc.)
   */
  async addResources(villageId: string, gain: Resources): Promise<void> {
    const resources = await this.getResources(villageId);

    const updated: Resources = {
      food: resources.food + gain.food,
      wood: resources.wood + gain.wood,
      stone: resources.stone + gain.stone,
      gold: resources.gold + gain.gold,
    };

    await this.prisma.village.update({
      where: { id: villageId },
      data: {
        foodAmount: updated.food,
        woodAmount: updated.wood,
        stoneAmount: updated.stone,
        goldAmount: updated.gold,
      },
    });

    this.socket.sendResourcesUpdate(villageId, updated);
  }
}
