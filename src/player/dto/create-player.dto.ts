import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePlayerDto {
  @ApiProperty({
    description: 'Unique username of the player',
    example: 'ShadowKnight42',
    minLength: 3,
  })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({
    description: 'Valid email address of the player',
    example: 'player@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Password of the player',
    example: 'strongPassword123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
  
  @IsString()
  raceId: string; // must be a valid Race.id
}
