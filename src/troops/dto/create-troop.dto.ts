import { IsString, IsIn, IsInt, Min } from 'class-validator';
import { TROOP_TYPES } from 'src/game/constants/troop.constants';

const troopKeys = Object.keys(TROOP_TYPES) as Array<keyof typeof TROOP_TYPES>;

export class CreateTroopDto {
  @IsString()
  @IsIn(troopKeys)
  troopType: keyof typeof TROOP_TYPES;

  @IsInt()
  @Min(1)
  count: number;
}
