import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SocketModule } from './socket/socket.module';
import { BuildingModule } from './building/building.module';
import { ConstructionModule } from './construction/construction.module';
import { VillageModule } from './village/village.module';
import { TrainingModule } from './training/training.module';
import { PrismaModule } from './prisma/prisma.module';

import { PlayerModule } from './player/player.module';
import { TroopModule } from './troops/troops.module';
import { ResourceModule } from './resource/resource.module';
import { CombatModule } from './combat/combat.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WorldModule } from './world/world.module';

@Module({
  imports: [
    SocketModule,
    PrismaModule,
    BuildingModule,
    EventEmitterModule.forRoot(),
    ConstructionModule,
    VillageModule,
    PlayerModule,
    TroopModule,
    ResourceModule,
    CombatModule,
    TrainingModule,
    WorldModule,

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
