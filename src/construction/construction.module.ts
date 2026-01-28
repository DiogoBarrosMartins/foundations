import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConstructionProcessor } from './construction.processor';
import { ConstructionService } from './construction.service';
import { BuildingModule } from '../building/building.module';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [
    forwardRef(() => BuildingModule),
    SocketModule,
    BullModule.registerQueue({
      name: 'construction',
    }),
  ],
  providers: [ConstructionService, ConstructionProcessor],
  exports: [ConstructionService, ConstructionProcessor],
})
export class ConstructionModule {}
