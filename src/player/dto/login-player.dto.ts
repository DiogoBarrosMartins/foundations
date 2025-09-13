import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginPlayerDto {
  @ApiProperty({
    description: 'Username of the player',
    example: 'ShadowKnight42',
  })
  @IsString()
  username: string;

  @ApiProperty({
    description: 'Password of the player',
    example: 'superSecret123',
  })
  @IsString()
  @MinLength(6)
  password: string;
}
