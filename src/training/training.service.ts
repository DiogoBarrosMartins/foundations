import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TrainingQueueService } from './training-queue.service';
import { BuildingType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TROOP_TYPES } from 'src/game/constants/troop.constants';
import { ResourceService } from '../resource/resource.service';

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);

  constructor(
    private prisma: PrismaService,
    private trainingQueue: TrainingQueueService,
    private eventEmitter: EventEmitter2,
    private resourceService: ResourceService,
  ) {}

  async startTraining(
    villageId: string,
    troopId: string,
    troopType: string,
    buildingType: BuildingType,
    count: number,
    unitTimeMs: number,
  ) {
    this.logger.log(`[startTraining] village=${villageId} ${troopType} x${count}`);

    const hasInProgress = await this.prisma.trainingTask.findFirst({
      where: { villageId, buildingType, status: 'in_progress' },
    });

    const status = hasInProgress ? 'pending' : 'in_progress';
    const startTime = status === 'in_progress' ? new Date() : null;
    const endTime = new Date(Date.now() + unitTimeMs * count)
;

    const task = await this.prisma.trainingTask.create({
      data: {
        villageId,
        troopId,
        troopType,
        buildingType,
        count,
        remaining: count,
        status,
        startTime,
        endTime,
      },
    });

    if (status === 'in_progress') {
      const job = await this.trainingQueue.queueTraining(task.id, unitTimeMs);
      await this.prisma.trainingTask.update({
        where: { id: task.id },
        data: { queueJobId: job.id?.toString() ?? null },
      });

      this.eventEmitter.emit('troop.training.started', {
        villageId,
        troopType,
        count,
        taskId: task.id,
      });
    }

    return task;
  }

  async forceCompleteTask(taskId: string) {
    this.logger.warn(`[forceCompleteTask] Task ${taskId}`);

    const task = await this.prisma.trainingTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);

    await this.prisma.troop.update({
      where: { id: task.troopId },
      data: { quantity: { increment: task.remaining } },
    });

    await this.prisma.trainingTask.update({
      where: { id: taskId },
      data: { status: 'completed', remaining: 0, endTime: new Date() },
    });

    this.eventEmitter.emit('troop.training.completed', {
      villageId: task.villageId,
      troopType: task.troopType,
      count: task.count,
      taskId,
    });

    await this.triggerNextTaskIfAvailable(task.villageId);
  }

  async triggerNextTaskIfAvailable(villageId: string) {
    const hasInProgress = await this.prisma.trainingTask.findFirst({
      where: { villageId, status: 'in_progress' },
    });
    if (hasInProgress) return;

    const next = await this.prisma.trainingTask.findFirst({
      where: { villageId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });
    if (!next) return;

    await this.prisma.trainingTask.update({
      where: { id: next.id },
      data: { status: 'in_progress', startTime: new Date() },
    });

    const unitTimeMs = Math.floor(
      (next.endTime.getTime() - Date.now()) / next.count,
    );
    const job = await this.trainingQueue.queueTraining(next.id, unitTimeMs);

    await this.prisma.trainingTask.update({
      where: { id: next.id },
      data: { queueJobId: job.id?.toString() ?? null },
    });

    this.eventEmitter.emit('troop.training.started', {
      villageId,
      troopType: next.troopType,
      count: next.count,
      taskId: next.id,
    });
  }

  async cancelTask(taskId: string) {
    this.logger.warn(`[cancelTask] Task ${taskId}`);

    const task = await this.prisma.trainingTask.findUnique({
      where: { id: taskId },
    });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    if (task.status === 'completed') {
      throw new BadRequestException(`Task ${taskId} is already completed`);
    }

    // calcula reembolso (80% dos recursos das tropas não treinadas)
    const def = TROOP_TYPES[task.troopType];
    if (!def) throw new Error(`Troop definition not found: ${task.troopType}`);

    const refundCount = task.remaining;
    const refund = {
      food: Math.floor(def.cost.food * refundCount * 0.8),
      wood: Math.floor(def.cost.wood * refundCount * 0.8),
      stone: Math.floor(def.cost.stone * refundCount * 0.8),
      gold: Math.floor(def.cost.gold * refundCount * 0.8),
    };

    await this.resourceService.addResources(task.villageId, refund);

    // marca como cancelada
    await this.prisma.trainingTask.update({
      where: { id: taskId },
      data: { status: 'cancelled', remaining: 0, endTime: new Date() },
    });

    if (task.queueJobId) {
      await this.trainingQueue.removeJob(task.queueJobId);
    }

    this.logger.log(
      `❌ Task ${taskId} cancelada. Reembolso: ${JSON.stringify(refund)}`,
    );

    return { message: `Task ${taskId} cancelled`, refund };
  }
}
