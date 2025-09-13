import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CombatQueueService } from './combat.queue.service';
import { TROOP_TYPES } from 'src/game/constants/troop.constants';
import { ValidatedBattlePayload } from 'src/game/constants/combat.type';
import { addSeconds, differenceInMilliseconds } from 'date-fns';
import { AttackRequestDto } from './dto/attack-request.dto';
import { SocketGateway } from 'src/socket/socket.gateway';

@Injectable()
export class CombatService {
  private readonly logger = new Logger(CombatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly combatQueue: CombatQueueService,
    private readonly socket: SocketGateway,
  ) {
    this.logger.log('[CombatService] Constructed');
  }

  async initiateAttack(dto: AttackRequestDto) {
    this.logger.log('[initiateAttack] Started', dto);

    const targetVillage = await this.prisma.village.findFirst({
      where: { x: dto.target.x, y: dto.target.y },
    });

    if (!targetVillage) {
      throw new NotFoundException(
        `No village found at target (${dto.target.x},${dto.target.y})`,
      );
    }

    const validated: ValidatedBattlePayload = {
      attackerVillageId: dto.attackerVillageId,
      origin: dto.origin,
      target: dto.target,
      troops: dto.troops,
      defenderVillageId: targetVillage.id,
    };

    return this.processValidatedBattle(validated);
  }

  async processValidatedBattle(payload: ValidatedBattlePayload) {
    this.logger.log('[processValidatedBattle] Started', payload);
    const { attackerVillageId, origin, target, troops, defenderVillageId } =
      payload;

    if (!defenderVillageId) {
      throw new NotFoundException('No defender village found at target coords');
    }

    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const troopSpeeds = troops.map((t) => TROOP_TYPES[t.troopType].speed);
    const slowestSpeed = Math.min(...troopSpeeds);
    const travelSeconds = distance / slowestSpeed;

    const now = new Date();
    const arrivalTime = addSeconds(now, travelSeconds);

    const createdBattle = await this.prisma.battle.create({
      data: {
        attackerVillageId,
        defenderVillageId,
        originX: origin.x,
        originY: origin.y,
        targetX: target.x,
        targetY: target.y,
        troops,
        startTime: now,
        arrivalTime,
        status: 'PENDING',
      },
    });

    const battleId = createdBattle.id;

    await this.prisma.armyMovement.create({
      data: {
        villageId: attackerVillageId,
        direction: 'outgoing',
        battleId,
        originX: origin.x,
        originY: origin.y,
        targetX: target.x,
        targetY: target.y,
        troops,
        arrivalTime,
      },
    });

    this.socket.server.emit('combat.update', {
      attackerVillageId,
      defenderVillageId,
      battleId,
      origin,
      target,
      troops,
      startTime: now,
      arrivalTime,
    });

    await this.combatQueue.queueBattleResolution(
      { battleId },
      differenceInMilliseconds(arrivalTime, now),
    );

    this.logger.log(`[processValidatedBattle] Battle ${battleId} queued`);

    return { battleId, arrivalTime };
  }

  async resolveBattle(battleId: string) {
    this.logger.log(`[resolveBattle] Resolving battle ${battleId}`);

    const battle = await this.prisma.battle.findUnique({
      where: { id: battleId },
    });

    if (!battle) {
      this.logger.warn(`[resolveBattle] Battle ${battleId} not found`);
      return;
    }

    await this.prisma.battle.update({
      where: { id: battleId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });

    this.socket.server.emit('combat.resolved', { battleId });
  }
}
