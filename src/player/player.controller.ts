import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PlayerService } from './player.service';
import { LoginPlayerDto } from './dto/login-player.dto';
import { JwtAuthGuard } from 'src/auth/JwtAuthGuard';

@ApiTags('Player')
@Controller('players')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) { }


  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the currently logged-in player' })
  @ApiResponse({ status: 200, description: 'Current player profile' })
  me(@Req() req: any) {
    return this.playerService.me(req.user.playerId);
  }
  @Post()
  @ApiOperation({ summary: 'Create a new player' })
  @ApiBody({ type: CreatePlayerDto })
  @ApiResponse({ status: 201, description: 'Player created successfully' })
  create(@Body() dto: CreatePlayerDto) {
    return this.playerService.create(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login a player' })
  @ApiBody({ type: LoginPlayerDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  login(@Body() dto: LoginPlayerDto) {
    return this.playerService.login(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all players' })
  @ApiResponse({ status: 200, description: 'List of players' })
  findAll() {
    return this.playerService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a player by ID' })
  @ApiParam({ name: 'id', description: 'Player UUID' })
  @ApiResponse({ status: 200, description: 'Player found' })
  findOne(@Param('id') id: string) {
    return this.playerService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a player' })
  @ApiParam({ name: 'id', description: 'Player UUID' })
  @ApiBody({ type: UpdatePlayerDto, description: 'Partial player data' })
  @ApiResponse({ status: 200, description: 'Player updated' })
  update(@Param('id') id: string, @Body() dto: UpdatePlayerDto) {
    return this.playerService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a player' })
  @ApiParam({ name: 'id', description: 'Player UUID' })
  @ApiResponse({ status: 200, description: 'Player marked as deleted' })
  softDelete(@Param('id') id: string) {
    return this.playerService.softDelete(id);
  }
}
