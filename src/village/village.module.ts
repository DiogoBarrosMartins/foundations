import { Module, forwardRef } from '@nestjs/common';
import { VillageService } from './village.service';
import { VillageController } from './village.controller';

import { ResourceModule } from '../resource/resource.module';
import { BuildingModule } from '../building/building.module';
import { ConstructionModule } from '../construction/construction.module';
import { TroopModule } from '../troops/troops.module';
import { TrainingModule } from '../training/training.module';

@Module({
  imports: [
    forwardRef(() => BuildingModule),
    forwardRef(() => ConstructionModule),
    ResourceModule,
    TroopModule,
    TrainingModule,
  ],
  controllers: [VillageController],
  providers: [VillageService],
  exports: [VillageService],
})
export class VillageModule {}
