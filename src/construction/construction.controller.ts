import { Controller, Post, Body } from '@nestjs/common';
import { ConstructionService } from './construction.service';
import { BuildingType } from '@prisma/client';

@Controller('construction')
export class ConstructionController {
  constructor(private readonly constructionService: ConstructionService) {}

  @Post('queue')
  async queueBuild(
    @Body()
    body: {
      villageId: string;
      buildingId: string;
      type: BuildingType;
      currentLevel: number;
      buildTimeMs: number;
    },
  ) {
    return this.constructionService.queueBuild(
      body.villageId,
      body.buildingId,
      body.type,
      body.currentLevel,
      body.buildTimeMs,
    );
  }
}
