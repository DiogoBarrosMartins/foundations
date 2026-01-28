import { Module, forwardRef } from '@nestjs/common';
import { BuildingService } from './building.service';
import { BuildingController } from './building.controller';
import { ConstructionModule } from '../construction/construction.module';
import { ResourceModule } from '../resource/resource.module';

@Module({
  imports: [
    ResourceModule,
    forwardRef(() => ConstructionModule),
  ],
  providers: [BuildingService],
  controllers: [BuildingController],
  exports: [BuildingService],
})
export class BuildingModule {}
