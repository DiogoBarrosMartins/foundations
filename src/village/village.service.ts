import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateVillageDto } from './dto/create-village.dto';
import { Race } from 'src/game/constants/race.constants';
import { ResourceService } from '../resource/resource.service';
import { BuildingService } from '../building/building.service';
import { TrainingService } from '../training/training.service';
import { ValidatedBattlePayload } from 'src/game/constants/combat.type';
import { PrismaService } from 'src/prisma/prisma.service';
import { AttackRequestDto } from '../combat/dto/attack-request.dto';
import { OnEvent } from '@nestjs/event-emitter';
import { ConstructionProcessor } from 'src/construction/construction.processor';

type CombatState = {
  outgoing: any[];
  incoming: any[];
};

@Injectable()
export class VillageService {
  private readonly logger = new Logger(VillageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resourceService: ResourceService,
    private readonly buildingService: BuildingService,
    private readonly trainingService: TrainingService,
    private readonly constructionProcessor: ConstructionProcessor,
  ) {
    this.logger.log('[VillageService] Constructed');
  }

  @OnEvent('player.created')
  async handlePlayerCreated(payload: {
    playerId: string;
    playerName: string;
    race: Race;
    name: string;
  }) {
    this.logger.log(`[VillageService] Creating village for player ${payload.playerName}`);

    const village = await this.prisma.village.create({
      data: {
        playerId: payload.playerId,
        playerName: payload.playerName,
        name: payload.name,
        x: Math.floor(Math.random() * 100),
        y: Math.floor(Math.random() * 100),
        foodAmount: 500,
        woodAmount: 500,
        stoneAmount: 500,
        goldAmount: 500,
        foodProductionRate: 10,
        woodProductionRate: 10,
        stoneProductionRate: 10,
        goldProductionRate: 8,
        lastCollectedAt: new Date(),
        race: payload.race,
      },
    });

    await this.buildingService.initializeBuildingsForVillage(village.id, payload.race);

    return { village };
  }

  async create(dto: CreateVillageDto) {
    this.logger.log('[VillageService] Creating village with DTO:', dto);

    const village = await this.prisma.village.create({
      data: {
        playerId: dto.playerId,
        playerName: dto.playerName,
        x: Math.floor(Math.random() * 100),
        y: Math.floor(Math.random() * 100),
        name: dto.name,
        foodAmount: 500,
        woodAmount: 500,
        stoneAmount: 500,
        goldAmount: 500,
        foodProductionRate: 10,
        woodProductionRate: 10,
        stoneProductionRate: 10,
        goldProductionRate: 8,
        lastCollectedAt: new Date(),
        race: dto.race as Race,
      },
    });

    await this.buildingService.initializeBuildingsForVillage(
      village.id,
      dto.race as Race,
    );

    return village;
  }

  async handleTileAllocated(data: {
    playerId: string;
    playerName: string;
    x: number;
    y: number;
    name: string;
    race: string;
  }) {
    this.logger.log('[VillageService] Handling tile allocation:', data);

    const existingVillage = await this.prisma.village.findFirst({
      where: {
        playerId: data.playerId,
        x: data.x,
        y: data.y,
      },
    });

    if (existingVillage) {
      this.logger.warn('[VillageService] Village already exists:', existingVillage);
      return existingVillage;
    }

    const village = await this.prisma.village.create({
      data: {
        playerId: data.playerId,
        playerName: data.playerName,
        x: data.x,
        y: data.y,
        name: data.name,
        foodAmount: 500,
        woodAmount: 500,
        stoneAmount: 500,
        goldAmount: 500,
        foodProductionRate: 10,
        woodProductionRate: 10,
        stoneProductionRate: 10,
        goldProductionRate: 8,
        lastCollectedAt: new Date(),
        race: data.race as Race,
      },
    });

    await this.buildingService.initializeBuildingsForVillage(
      village.id,
      data.race as Race,
    );

    return village;
  }

  /**
   * Get all villages with a single optimized query.
   * FIXED: Removed N+1 query pattern.
   */
  async findAll() {
    this.logger.log('[VillageService] findAll called');

    // Single query with all includes - no N+1!
    const villages = await this.prisma.village.findMany({
      include: {
        buildings: true,
        troops: {
          where: { status: 'idle' },
        },
        trainingTasks: {
          where: { status: { not: 'completed' } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Calculate resources in-memory without updating DB
    const now = new Date();
    return villages.map((village) => {
      const elapsedSec = Math.floor(
        (now.getTime() - village.lastCollectedAt.getTime()) / 1000,
      );

      return {
        ...village,
        // Calculated resources (not persisted, just for display)
        calculatedResources: {
          food: village.foodAmount + elapsedSec * village.foodProductionRate,
          wood: village.woodAmount + elapsedSec * village.woodProductionRate,
          stone: village.stoneAmount + elapsedSec * village.stoneProductionRate,
          gold: village.goldAmount + elapsedSec * village.goldProductionRate,
        },
      };
    });
  }

  async getVillageDetails(villageId: string) {
    this.logger.log(`[VillageService] Fetching details for ${villageId}`);
    return this.refreshVillageState(villageId);
  }

  async findByPlayer(playerId: string) {
    // Single query instead of N+1
    const villages = await this.prisma.village.findMany({
      where: { playerId },
      include: {
        buildings: true,
        troops: true,
        trainingTasks: {
          where: { status: { not: 'completed' } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Only refresh the first village (current active), others just return data
    if (villages.length > 0) {
      await this.resourceService.getResources(villages[0].id);
    }

    return villages;
  }

  async remove(id: string) {
    this.logger.log('[VillageService] Removing village with ID:', id);
    await this.prisma.village.delete({ where: { id } });
    return { message: `Village ${id} deleted` };
  }

  async handleCombatUpdate(payload: {
    villageId?: string;
    coords?: { x: number; y: number };
    combat: {
      type: 'incoming' | 'outgoing';
      battleId: string;
      targetX?: number;
      targetY?: number;
      originX?: number;
      originY?: number;
      arrivalTime: string;
      [key: string]: any;
    };
  }) {
    this.logger.log('[VillageService] Handling combat update:', payload);
    const { villageId, coords, combat } = payload;

    if (!villageId && !coords) {
      throw new BadRequestException('Village ID or coordinates are required');
    }

    // Use transaction to prevent race conditions on combat state
    await this.prisma.$transaction(async (tx) => {
      const village = villageId
        ? await tx.village.findUniqueOrThrow({
            where: { id: villageId },
          })
        : await tx.village.findFirstOrThrow({
            where: { x: coords!.x, y: coords!.y },
          });

      const state: CombatState =
        (village as any).combatState || { outgoing: [], incoming: [] };

      if (combat.type === 'incoming') {
        delete combat.troops;
      }

      state[combat.type] ??= [];

      // Limit combat state size to prevent infinite growth
      if (state[combat.type].length >= 100) {
        state[combat.type] = state[combat.type].slice(-50);
      }

      state[combat.type].push(combat);

      await tx.village.update({
        where: { id: village.id },
        data: { combatState: state as any },
      });
    });

    this.logger.log(`[VillageService] Combat state updated for ${combat.type}`);
  }

  /**
   * Refresh village state - optimized version with fewer queries.
   */
  async refreshVillageState(villageId: string) {
    this.logger.log(`[VillageService] Refreshing state for village ${villageId}`);

    // Single query to get all data
    const village = await this.prisma.village.findUniqueOrThrow({
      where: { id: villageId },
      include: {
        trainingTasks: {
          orderBy: { createdAt: 'asc' },
        },
        buildings: true,
        troops: true,
      },
    });

    const now = new Date();

    // Collect resources atomically
    await this.resourceService.getResources(villageId);

    // Process expired training tasks
    const expiredTasks = village.trainingTasks.filter(
      (t) => t.status === 'in_progress' && t.endTime && new Date(t.endTime) <= now,
    );

    if (expiredTasks.length > 0) {
      // Batch complete all expired tasks
      for (const task of expiredTasks) {
        this.logger.log(`[VillageService] Completing expired training task ${task.id}`);
        await this.trainingService.forceCompleteTask(task.id);
      }
    }

    // Trigger next pending task if no in-progress
    const hasInProgress = village.trainingTasks.some((t) => t.status === 'in_progress');
    if (!hasInProgress) {
      const hasPending = village.trainingTasks.some((t) => t.status === 'pending');
      if (hasPending) {
        await this.trainingService.triggerNextTaskIfAvailable(villageId);
      }
    }

    // Process expired buildings
    const expiredBuildings = village.buildings.filter(
      (b) => b.status === 'queued' && b.queuedUntil && new Date(b.queuedUntil) <= now,
    );

    for (const building of expiredBuildings) {
      await this.constructionProcessor.finishBuilding(
        villageId,
        building.id,
        building.type,
        building.level + 1,
      );
    }

    // Return fresh data
    return this.prisma.village.findUniqueOrThrow({
      where: { id: villageId },
      include: {
        buildings: true,
        troops: {
          where: { status: 'idle' },
        },
        trainingTasks: {
          where: { status: { not: 'completed' } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async createArmyMovement(payload: {
    villageId: string;
    direction: 'incoming' | 'outgoing';
    battleId: string;
    originX: number;
    originY: number;
    targetX: number;
    targetY: number;
    troops: { troopType: string; quantity: number }[];
    arrivalTime: string;
  }) {
    this.logger.log('[VillageService] Creating army movement:', payload);
    await this.prisma.armyMovement.create({
      data: {
        villageId: payload.villageId,
        direction: payload.direction,
        battleId: payload.battleId,
        originX: payload.originX,
        originY: payload.originY,
        targetX: payload.targetX,
        targetY: payload.targetY,
        troops: payload.troops,
        arrivalTime: new Date(payload.arrivalTime),
      },
    });

    this.logger.log(`[VillageService] Movement ${payload.direction} registered for village ${payload.villageId}`);
  }

  async validateBattleRequest(dto: AttackRequestDto) {
    this.logger.log('[VillageService] Validating battle request:', dto);

    const village = await this.getVillageDetails(dto.attackerVillageId);

    if (village.x !== dto.origin.x || village.y !== dto.origin.y) {
      this.logger.warn('[VillageService] Invalid origin coordinates');
      throw new BadRequestException('Invalid origin coordinates');
    }

    for (const req of dto.troops) {
      const vTroop = village.troops.find((t) => t.troopType === req.troopType);
      if (!vTroop || vTroop.quantity < req.quantity) {
        this.logger.warn('[VillageService] Insufficient troops:', req);
        throw new BadRequestException(`Insufficient troops: ${req.troopType}`);
      }
    }

    await this.reserveTroopsForBattle(dto.attackerVillageId, dto.troops);

    const targetVillage = await this.prisma.village.findFirst({
      where: { x: dto.target.x, y: dto.target.y },
    });

    if (!targetVillage) {
      throw new NotFoundException(
        `No target village found at (${dto.target.x}, ${dto.target.y})`,
      );
    }

    const validated: ValidatedBattlePayload = {
      attackerVillageId: dto.attackerVillageId,
      origin: dto.origin,
      target: dto.target,
      troops: dto.troops,
      defenderVillageId: targetVillage.id,
    };

    return { status: 'VALIDATED', validated };
  }

  /**
   * Reserve troops for battle using atomic transaction.
   * FIXED: Prevents race conditions with concurrent attacks.
   */
  private async reserveTroopsForBattle(
    villageId: string,
    troops: { troopType: string; quantity: number }[],
  ) {
    this.logger.log('[VillageService] Reserving troops for battle:', { villageId, troops });

    await this.prisma.$transaction(async (tx) => {
      for (const { troopType, quantity } of troops) {
        // Lock and check current troop count
        const currentTroop = await tx.troop.findFirst({
          where: { villageId, troopType, status: 'idle' },
        });

        if (!currentTroop || currentTroop.quantity < quantity) {
          throw new BadRequestException(
            `Insufficient troops: need ${quantity} ${troopType}, have ${currentTroop?.quantity ?? 0}`,
          );
        }

        // Atomic decrement with check
        const updated = await tx.troop.update({
          where: { id: currentTroop.id },
          data: { quantity: { decrement: quantity } },
        });

        // Verify we didn't go negative (extra safety)
        if (updated.quantity < 0) {
          throw new BadRequestException(
            `Race condition detected: insufficient ${troopType}`,
          );
        }

        // Handle on_route troops
        const existingOnRoute = await tx.troop.findFirst({
          where: { villageId, troopType, status: 'on_route' },
        });

        if (existingOnRoute) {
          await tx.troop.update({
            where: { id: existingOnRoute.id },
            data: { quantity: { increment: quantity } },
          });
        } else {
          await tx.troop.create({
            data: { villageId, troopType, quantity, status: 'on_route' },
          });
        }
      }
    });

    this.logger.log('[VillageService] Troops reserved successfully');
  }
}
