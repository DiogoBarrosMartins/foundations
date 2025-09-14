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
import { Village, TrainingTask, BuildingType } from '@prisma/client';
import { OnEvent } from '@nestjs/event-emitter';
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
  ) {
    this.logger.log('[VillageService] Constructed');
  }

  @OnEvent('player.created') // 👂 Ouve evento
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
        resourceAmounts: { food: 500, wood: 500, stone: 500, gold: 500 },
        resourceProductionRates: { food: 10, wood: 10, stone: 10, gold: 8 },
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
        resourceAmounts: {
          food: 500,
          wood: 500,
          stone: 500,
          gold: 500,
        },
        resourceProductionRates: {
          food: 10,
          wood: 10,
          stone: 10,
          gold: 8,
        },
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
      this.logger.warn(
        '[VillageService] Village already exists:',
        existingVillage,
      );
      return existingVillage;
    }

    const village = await this.prisma.village.create({
      data: {
        playerId: data.playerId,
        playerName: data.playerName,
        x: data.x,
        y: data.y,
        name: data.name,
        resourceAmounts: {
          food: 500,
          wood: 500,
          stone: 500,
          gold: 500,
        },
        resourceProductionRates: {
          food: 10,
          wood: 10,
          stone: 10,
          gold: 8,
        },
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

async findAll() {
  this.logger.log('[VillageService] findAll called');

  const villages = await this.prisma.village.findMany();

  await Promise.all(
    villages.map((v) => this.resourceService.getResources(v.id)),
  );

  return this.prisma.village.findMany({
    include: {
      buildings: true,
      troops: true,
      trainingTasks: {
        where: { status: { not: 'completed' } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}


  async findByPlayer(playerId: string): Promise<Village[]> {
    this.logger.log('[VillageService] Finding villages for player:', playerId);

    const villages = await this.prisma.village.findMany({
      where: { playerId },
    });

    if (villages.length === 0) {
      this.logger.warn('[VillageService] No villages found for player:', playerId);
      throw new NotFoundException(`No villages found for player ${playerId}`);
    }

    await Promise.all(
      villages.map((v) => this.resourceService.getResources(v.id)),
    );

    const now = new Date();
    const villageIds = villages.map((v) => v.id);

    const tasksToForce = await this.prisma.trainingTask.findMany({
      where: {
        status: 'in_progress',
        endTime: { lte: now },
        villageId: { in: villageIds },
      },
    });

    if (tasksToForce.length > 0) {
      this.logger.log(
        `[VillageService] Forcing completion of ${tasksToForce.length} expired training tasks`,
      );

      await Promise.all(
        tasksToForce.map((task) =>
          this.trainingService.forceCompleteTask(task.id),
        ),
      );
    } else {
      for (const villageId of villageIds) {
        const hasInProgress = await this.prisma.trainingTask.findFirst({
          where: { villageId, status: 'in_progress' },
        });

        const hasPending = await this.prisma.trainingTask.findFirst({
          where: { villageId, status: 'pending' },
        });

        if (!hasInProgress && hasPending) {
          this.logger.log(
            `[VillageService] No in_progress task for ${villageId}, activating pending task`,
          );
          await this.trainingService.triggerNextTaskIfAvailable(villageId);
        }
      }
    }

    return this.prisma.village.findMany({
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

    const village = villageId
      ? await this.prisma.village.findUniqueOrThrow({
        where: { id: villageId },
      })
      : await this.prisma.village.findFirstOrThrow({
        where: { x: coords!.x, y: coords!.y },
      });

    const state: CombatState =
      (village as any).combatState || { outgoing: [], incoming: [] };

    if (combat.type === 'incoming') {
      delete combat.troops;
    }

    state[combat.type] ??= [];
    state[combat.type].push(combat);

    await this.prisma.village.update({
      where: { id: village.id },
      data: { combatState: state as any },
    });

    this.logger.log(
      `[VillageService] Combat state updated for ${combat.type} village`,
      village.id,
    );
  }

  async getVillageDetails(villageId: string) {
    this.logger.log(`[getVillageDetails] Fetching details for ${villageId}`);

    const village = await this.prisma.village.findUnique({
      where: { id: villageId },
      include: {
        trainingTasks: {
          where: { status: 'in_progress' },
        },
        troops: true,
      },
    });

    if (!village) {
      this.logger.warn(`[getVillageDetails] Not found: ${villageId}`);
      throw new NotFoundException(`Village ${villageId} not found`);
    }

    const now = new Date();
    const expiredTasks = village.trainingTasks.filter(
      (t) => t.endTime && new Date(t.endTime) <= now,
    );

    if (expiredTasks.length > 0) {
      this.logger.warn(
        `[getVillageDetails] ${expiredTasks.length} expired tasks found`,
      );

      for (const task of expiredTasks) {
        await this.trainingService.forceCompleteTask(task.id);
      }

      return this.getVillageDetails(villageId);
    }

    return {
      id: village.id,
      x: village.x,
      y: village.y,
      playerId: village.playerId,
      troops: village.troops.map((t) => ({
        troopType: t.troopType,
        quantity: t.quantity,
      })),
    };
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

    this.logger.log(
      `✅ Movement ${payload.direction} Registered for village ${payload.villageId}`,
    );
  }

  async validateBattleRequest(dto: AttackRequestDto) {
    this.logger.log('[VillageService] Validating battle request:', dto);

    const village = await this.getVillageDetails(dto.attackerVillageId);

    if (village.x !== dto.origin.x || village.y !== dto.origin.y) {
      this.logger.warn('[VillageService] Invalid origin coordinates');
      throw new BadRequestException('Invalid origin coordinates');
    }

    for (const req of dto.troops) {
      const vTroop = village.troops.find(
        (t) => t.troopType === req.troopType,
      );
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

  private async reserveTroopsForBattle(
    villageId: string,
    troops: { troopType: string; quantity: number }[],
  ) {
    this.logger.log('[VillageService] Reserving troops for battle:', {
      villageId,
      troops,
    });

    for (const { troopType, quantity } of troops) {
      const updated = await this.prisma.troop.updateMany({
        where: { villageId, troopType },
        data: { quantity: { decrement: quantity } },
      });

      if (!updated.count) {
        this.logger.warn(
          `[VillageService] Failed to reserve troops: ${troopType}`,
        );
        continue;
      }

      const existing = await this.prisma.troop.findFirst({
        where: { villageId, troopType, status: 'on_route' },
      });

      if (existing) {
        await this.prisma.troop.update({
          where: { id: existing.id },
          data: { quantity: { increment: quantity } },
        });
      } else {
        await this.prisma.troop.create({
          data: { villageId, troopType, quantity, status: 'on_route' },
        });
      }
    }
  }
}
