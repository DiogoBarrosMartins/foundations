import { Module, forwardRef } from '@nestjs/common';
import { BuildingService } from './building.service';
import { BuildingController } from './building.controller';
import { ConstructionModule } from '../construction/construction.module';
import { ResourceModule } from '../resource/resource.module';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [
    ResourceModule,
    forwardRef(() => ConstructionModule),
  ],
  providers: [PrismaService, BuildingService],
  controllers: [BuildingController],
  exports: [BuildingService],
})
export class BuildingModule {}
