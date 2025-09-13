import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SocketModule } from './socket/socket.module';
import { BuildingModule } from './building/building.module';
import { ConstructionModule } from './construction/construction.module';
import { VillageModule } from './village/village.module';
import { TrainingModule } from './training/training.module';
import { PrismaModule } from './prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { PlayerModule } from './player/player.module';
import { TroopModule } from './troops/troops.module';
import { ResourceModule } from './resource/resource.module';
import { CombatModule } from './combat/combat.module';

@Module({
  imports: [
    SocketModule,
    PrismaModule,
    BuildingModule,
    ConstructionModule,
    VillageModule,
    PlayerModule,
    TroopModule,
    ResourceModule,
    CombatModule,
    TrainingModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
