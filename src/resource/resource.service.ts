import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SocketGateway } from '../socket/socket.gateway';
import { PrismaService } from 'src/prisma/prisma.service';
import { Resources } from 'src/game/constants/resource.constants';
import { Prisma } from '@prisma/client';

@Injectable()
export class ResourceService {
  private readonly logger = new Logger(ResourceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly socket: SocketGateway,
  ) {}

  /**
   * Gets and updates resources with accumulated production.
   * Uses optimistic concurrency via lastCollectedAt timestamp.
   */
  async getResources(villageId: string): Promise<Resources> {
    const now = new Date();

    // Atomic update with calculated resources based on time elapsed
    const village = await this.prisma.village.update({
      where: { id: villageId },
      data: {
        lastCollectedAt: now,
        // Use raw SQL for atomic increment based on time elapsed
        foodAmount: {
          increment: 0, // Will be calculated below
        },
      },
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
      },
    });

    // For proper atomic resource collection, use a transaction with raw SQL
    const result = await this.prisma.$queryRaw<
      Array<{
        foodAmount: number;
        woodAmount: number;
        stoneAmount: number;
        goldAmount: number;
      }>
    >`
      UPDATE "Village"
      SET
        "foodAmount" = "foodAmount" + EXTRACT(EPOCH FROM (NOW() - "lastCollectedAt"))::INTEGER * "foodProductionRate",
        "woodAmount" = "woodAmount" + EXTRACT(EPOCH FROM (NOW() - "lastCollectedAt"))::INTEGER * "woodProductionRate",
        "stoneAmount" = "stoneAmount" + EXTRACT(EPOCH FROM (NOW() - "lastCollectedAt"))::INTEGER * "stoneProductionRate",
        "goldAmount" = "goldAmount" + EXTRACT(EPOCH FROM (NOW() - "lastCollectedAt"))::INTEGER * "goldProductionRate",
        "lastCollectedAt" = NOW()
      WHERE id = ${villageId}
      RETURNING "foodAmount", "woodAmount", "stoneAmount", "goldAmount"
    `;

    if (!result || result.length === 0) {
      throw new BadRequestException(`Village ${villageId} not found`);
    }

    const resources: Resources = {
      food: Number(result[0].foodAmount),
      wood: Number(result[0].woodAmount),
      stone: Number(result[0].stoneAmount),
      gold: Number(result[0].goldAmount),
    };

    this.socket.sendResourcesUpdate(villageId, resources);
    return resources;
  }

  /**
   * Deducts resources atomically using a transaction.
   * Throws if insufficient resources.
   */
  async deductResources(villageId: string, cost: Resources): Promise<void> {
    const result = await this.prisma.$transaction(async (tx) => {
      // First, collect pending resources and get current state
      const collected = await tx.$queryRaw<
        Array<{
          foodAmount: number;
          woodAmount: number;
          stoneAmount: number;
          goldAmount: number;
        }>
      >`
        UPDATE "Village"
        SET
          "foodAmount" = "foodAmount" + EXTRACT(EPOCH FROM (NOW() - "lastCollectedAt"))::INTEGER * "foodProductionRate",
          "woodAmount" = "woodAmount" + EXTRACT(EPOCH FROM (NOW() - "lastCollectedAt"))::INTEGER * "woodProductionRate",
          "stoneAmount" = "stoneAmount" + EXTRACT(EPOCH FROM (NOW() - "lastCollectedAt"))::INTEGER * "stoneProductionRate",
          "goldAmount" = "goldAmount" + EXTRACT(EPOCH FROM (NOW() - "lastCollectedAt"))::INTEGER * "goldProductionRate",
          "lastCollectedAt" = NOW()
        WHERE id = ${villageId}
        RETURNING "foodAmount", "woodAmount", "stoneAmount", "goldAmount"
      `;

      if (!collected || collected.length === 0) {
        throw new BadRequestException(`Village ${villageId} not found`);
      }

      const current = collected[0];

      // Check if we have enough resources
      if (Number(current.foodAmount) < cost.food) {
        throw new BadRequestException(
          `Insufficient food: need ${cost.food}, have ${current.foodAmount}`,
        );
      }
      if (Number(current.woodAmount) < cost.wood) {
        throw new BadRequestException(
          `Insufficient wood: need ${cost.wood}, have ${current.woodAmount}`,
        );
      }
      if (Number(current.stoneAmount) < cost.stone) {
        throw new BadRequestException(
          `Insufficient stone: need ${cost.stone}, have ${current.stoneAmount}`,
        );
      }
      if (Number(current.goldAmount) < cost.gold) {
        throw new BadRequestException(
          `Insufficient gold: need ${cost.gold}, have ${current.goldAmount}`,
        );
      }

      // Deduct resources atomically
      const updated = await tx.village.update({
        where: { id: villageId },
        data: {
          foodAmount: { decrement: cost.food },
          woodAmount: { decrement: cost.wood },
          stoneAmount: { decrement: cost.stone },
          goldAmount: { decrement: cost.gold },
        },
        select: {
          foodAmount: true,
          woodAmount: true,
          stoneAmount: true,
          goldAmount: true,
        },
      });

      return {
        food: updated.foodAmount,
        wood: updated.woodAmount,
        stone: updated.stoneAmount,
        gold: updated.goldAmount,
      };
    });

    this.socket.sendResourcesUpdate(villageId, result);
  }

  /**
   * Adds resources atomically.
   */
  async addResources(villageId: string, gain: Resources): Promise<void> {
    const updated = await this.prisma.village.update({
      where: { id: villageId },
      data: {
        foodAmount: { increment: gain.food },
        woodAmount: { increment: gain.wood },
        stoneAmount: { increment: gain.stone },
        goldAmount: { increment: gain.gold },
      },
      select: {
        foodAmount: true,
        woodAmount: true,
        stoneAmount: true,
        goldAmount: true,
      },
    });

    const resources: Resources = {
      food: updated.foodAmount,
      wood: updated.woodAmount,
      stone: updated.stoneAmount,
      gold: updated.goldAmount,
    };

    this.socket.sendResourcesUpdate(villageId, resources);
  }

  /**
   * Get resources without updating (for read-only operations).
   * Still collects pending production.
   */
  async getResourcesReadOnly(villageId: string): Promise<Resources> {
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
      },
    });

    const now = new Date();
    const elapsedSec = Math.floor(
      (now.getTime() - village.lastCollectedAt.getTime()) / 1000,
    );

    return {
      food: village.foodAmount + elapsedSec * village.foodProductionRate,
      wood: village.woodAmount + elapsedSec * village.woodProductionRate,
      stone: village.stoneAmount + elapsedSec * village.stoneProductionRate,
      gold: village.goldAmount + elapsedSec * village.goldProductionRate,
    };
  }
}
