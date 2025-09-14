import { Controller, Post, Param, Body, ParseUUIDPipe, Get } from '@nestjs/common';
import { TroopService } from './troops.service';
import { CreateTroopDto } from './dto/create-troop.dto';

@Controller('villages/:villageId/troops')
export class TroopsController {
  constructor(private readonly troopService: TroopService) {}

  @Post()
  async trainTroops(
    @Param('villageId', new ParseUUIDPipe()) villageId: string,
    @Body() dto: CreateTroopDto,
  ) {
    return this.troopService.trainTroops(villageId, dto.troopType, dto.count);
  }
    @Get('definitions')
  async getTroopDefinitions(@Param('villageId') villageId: string) {
    return this.troopService.getTroopDefinitions(villageId);
  }
  
}
