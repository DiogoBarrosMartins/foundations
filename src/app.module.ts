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
import { BullModule } from '@nestjs/bull';

// Parse Redis URL or use individual host/port
function getRedisConfig() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const url = new URL(redisUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
        username: url.username || undefined,
        tls: url.protocol === 'rediss:' ? {} : undefined,
      };
    } catch {
      console.warn('Failed to parse REDIS_URL, falling back to host/port');
    }
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  };
}

@Module({
  imports: [
  BullModule.forRoot({
    redis: getRedisConfig(),
  }),
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
