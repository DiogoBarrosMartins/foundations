import { Module } from '@nestjs/common';
import { WorldService } from './world.service';
import { WorldController } from './world.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [],
  controllers: [WorldController],
  providers: [WorldService, PrismaService],
  exports: [WorldService],
})
export class WorldModule {}
