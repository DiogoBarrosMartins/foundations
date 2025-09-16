import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WorldService } from './world.service';
import { WorldController } from './world.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  // If your app already has EventEmitterModule.forRoot() in AppModule, remove it here.
  imports: [PrismaModule, EventEmitterModule.forRoot()],
  providers: [WorldService],
  controllers: [WorldController],
  exports: [WorldService],
})
export class WorldModule {}
