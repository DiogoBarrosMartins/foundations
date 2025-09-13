import { Controller, Post, Body } from '@nestjs/common';
import { BuildingService } from './building.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UpgradeBuildingDto } from './dto/update-building.dto';

@ApiTags('Buildings')
@Controller('buildings')
export class BuildingController {
  constructor(private readonly buildingService: BuildingService) {}

  @Post('upgrade')
  @ApiOperation({ summary: 'Upgrade a village building' })
  @ApiResponse({ status: 201, description: 'Upgrade started successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid parameters.' })
  async upgrade(@Body() dto: UpgradeBuildingDto) {
    return this.buildingService.upgradeBuilding(dto.villageId, dto.type);
  }
}
