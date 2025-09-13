import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BuildingType, TrainingTask } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TrainingQueueService } from './training-queue.service';
import { TROOP_TYPES } from 'src/game/constants/troop.constants';

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trainingQueue: TrainingQueueService,
  ) {}

  async forceCompleteTask(taskId: string): Promise<void> {
    const task = await this.prisma.trainingTask.findUnique({ where: { id: taskId } });
    if (!task || task.status === 'completed') return;

    await this.prisma.troop.update({
      where: { id: task.troopId },
      data: { quantity: { increment: task.remaining } },
    });

    await this.prisma.trainingTask.update({
      where: { id: taskId },
      data: { status: 'completed', remaining: 0 },
    });

    this.logger.log(`[TrainingService] Force-completed task ${taskId}`);
  }

  async startTraining(
    villageId: string,
    troopId: string,
    troopType: string,
    buildingType: BuildingType,
    count: number,
    unitTimeMs: number,
  ): Promise<{ taskId: string; finishAt: Date }> {

    const building = await this.prisma.building.findFirst({
      where: { villageId, type: buildingType },
    });
    if (!building) throw new NotFoundException('Required building not found');

    const troopDef = TROOP_TYPES[troopType];
    if (!troopDef) throw new BadRequestException('Invalid troop type');

    if (building.level < troopDef.requiredLevel) {
      throw new BadRequestException(
        `Building level too low. Requires ${troopDef.requiredLevel}, has ${building.level}`,
      );
    }

    const existingTask = await this.prisma.trainingTask.findFirst({
      where: { villageId, buildingType, status: 'in_progress' },
    });

    const endTime = new Date(Date.now() + count * unitTimeMs);

    const task = await this.prisma.trainingTask.create({
      data: {
        troopType,
        troopId,
        villageId,
        count,
        remaining: count,
        status: existingTask ? 'pending' : 'in_progress',
        endTime,
        startTime: existingTask ? null : new Date(),
        buildingType,
      },
    });

    if (!existingTask) {
      const job = await this.trainingQueue.queueTraining(task.id, unitTimeMs);

      await this.prisma.trainingTask.update({
        where: { id: task.id },
        data: { queueJobId: job.id?.toString() ?? null },
      });
    }

    return { taskId: task.id, finishAt: endTime };
  }

  async triggerNextTaskIfAvailable(villageId: string) {
    const next = await this.prisma.trainingTask.findFirst({
      where: { villageId, status: 'pending' },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (next) {
      await this.startTask(next);
    }
  }

  private async startTask(task: TrainingTask): Promise<void> {
    if (!task.startTime || !task.endTime) {
      this.logger.warn(
        `[TrainingService] Task ${task.id} is missing startTime or endTime.`,
      );
      return;
    }

    const unitTimeMs =
      (task.endTime.getTime() - task.startTime.getTime()) / task.count;

    const job = await this.trainingQueue.queueTraining(task.id, unitTimeMs);

    await this.prisma.trainingTask.update({
      where: { id: task.id },
      data: {
        status: 'in_progress',
        startTime: new Date(),
        queueJobId: job.id ? job.id.toString() : null,
      },
    });

    this.logger.log(
      `[TrainingService] Started task ${task.id} (${task.count} x ${task.troopType})`,
    );
  }
}
