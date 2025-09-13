import { Process, Processor } from '@nestjs/bull';

import { CombatService } from './combat.service';
import type { Job } from 'bull';

@Processor('combat')
export class CombatProcessor {
  constructor(private readonly combatService: CombatService) {}

  @Process('resolveBattle')
  async handleResolveBattle(job: Job<{ battleId: string }>) {
    await this.combatService.resolveBattle(job.data.battleId);
  }
}
