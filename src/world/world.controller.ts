import { Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { WorldService } from './world.service';

@Controller('world')
export class WorldController {
  constructor(private readonly worldService: WorldService) {}

  // 🔥 Novo endpoint para o frontend
  @Get('map')
  async getWorldMap() {
    return this.worldService.getWorldMap();
  }

  @Get('map/raw')
  async getRawTileMap() {
    return this.worldService.getAllTiles();
  }

  @Get(':x/:y')
  async getNearbyTiles(
    @Param('x', ParseIntPipe) x: number,
    @Param('y', ParseIntPipe) y: number,
    @Query('radius') radius = '5',
  ) {
    const parsedRadius = Math.max(1, Math.min(10, parseInt(radius, 10) || 5));
    return this.worldService.getTilesAround(x, y, parsedRadius);
  }

  @Post('reset')
  // @UseGuards(AuthGuard)  // 👈 descomenta se quiseres proteger
  async resetWorld() {
    await this.worldService.generateWorld();
    return { message: '🌍 World reset complete' };
  }
}
