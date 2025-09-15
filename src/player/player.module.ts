import { forwardRef, Module } from '@nestjs/common';
import { PlayerService } from './player.service';
import { PlayerController } from './player.controller';
import { PrismaService } from '../prisma/prisma.service';
import { VillageModule } from '../village/village.module';

@Module({
  imports: [forwardRef(() => VillageModule)],
  controllers: [PlayerController],
  providers: [PlayerService, PrismaService],
})
export class PlayerModule {}
