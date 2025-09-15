import { Module, forwardRef } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { ConstructionProcessor } from './construction.processor';

import { ConstructionService } from './construction.service';
import { BuildingModule } from '../building/building.module';

@Module({
  imports: [
    forwardRef(() => BuildingModule),
  ],
  providers: [PrismaService, ConstructionService, ConstructionProcessor],
  exports: [ConstructionService, ConstructionProcessor],
})
export class ConstructionModule {}
