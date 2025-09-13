import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BuildingType } from '@prisma/client';

export class UpgradeBuildingDto {
  @ApiProperty({ description: 'Village ID' })
  @IsString()
  @IsNotEmpty()
  villageId: string;

  @ApiProperty({ description: 'Building type', enum: BuildingType })
  @IsNotEmpty()
  type: BuildingType;
}
