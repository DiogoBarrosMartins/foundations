import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, RaceName, Tile } from '@prisma/client';
import { getStaticRaces } from 'src/game/constants/race.constants';
import { PrismaService } from 'src/prisma/prisma.service';

const WORLD_SIZE = 100;
const HALF_WORLD = Math.floor(WORLD_SIZE / 2);
const NPC_VILLAGE_COUNT = 20;

enum TileType {
  EMPTY = 'EMPTY',
  VILLAGE = 'VILLAGE',
  OUTPOST = 'OUTPOST',
  SHRINE = 'SHRINE',
}

enum Zone {
  CORE = 'CORE',
  MID = 'MID',
  OUTER = 'OUTER',
}

enum Biome {
  PLAINS = 'PLAINS',
  FOREST = 'FOREST',
  MOUNTAIN = 'MOUNTAIN',
  HILLS = 'HILLS',
  SWAMP = 'SWAMP',
  DESERT = 'DESERT',
}

@Injectable()
export class WorldService {
  private readonly logger = new Logger(WorldService.name);
  private readonly reservedTiles = new Set<string>();
  eventEmitter: EventEmitter2 = new EventEmitter2();

  constructor(private readonly prisma: PrismaService) {}

  // ========================
  // GET MAP ENDPOINT
  // ========================
  async getWorldMap() {
    this.logger.log('[WorldService] getWorldMap called');

    const tiles = await this.prisma.tile.findMany({
      select: {
        x: true,
        y: true,
        type: true,
        name: true,
        race: true,
        playerName: true,
        metadata: true,
      },
    });

    return tiles.map((t) => {
      let mappedType: 'village' | 'outpost' | 'resource' | 'npc' = 'resource';

      switch (t.type) {
        case 'VILLAGE':
          mappedType = 'village';
          break;
        case 'OUTPOST':
          mappedType = 'outpost';
          break;
        case 'EMPTY':
        case 'SHRINE':
          mappedType = 'resource';
          break;
        default:
          mappedType = 'npc';
      }

      return {
        x: t.x,
        y: t.y,
        type: mappedType,
        name: t.name,
        owner: t.playerName ?? undefined,
        biome: t.metadata?.biome ?? null,
        bonus: t.metadata?.bonus ?? null,
      };
    });
  }

  async getAllTiles() {
    return this.prisma.tile.findMany({
      select: { x: true, y: true, type: true, race: true, name: true, metadata: true },
    });
  }

  // ========================
  // PLAYER VILLAGE ALLOCATION
  // ========================
  @OnEvent('player.created')
  async allocateVillageTile(payload: {
    playerId: string;
    playerName: string;
    race: string;
    name: string;
  }) {
    this.logger.log(`[WorldService] Allocating tile for ${payload.playerName}`);

    const x = Math.floor(Math.random() * 100) - 50;
    const y = Math.floor(Math.random() * 100) - 50;

    await this.prisma.tile.update({
      where: { x_y: { x, y } },
      data: {
        name: payload.name,
        type: 'VILLAGE',
        race: payload.race as any,
        playerId: payload.playerId,
        playerName: payload.playerName,
      },
    });

    this.logger.log(
      `✅ Village ${payload.name} placed at (${x}, ${y}) for ${payload.playerName}`,
    );
  }

  // ========================
  // WORLD GENERATION
  // ========================
  async onModuleInit(): Promise<void> {
    const existingWorld = await this.prisma.world.findFirst();

    if (!existingWorld) {
      this.logger.warn('🌍 No world found. Generating one...');
      await this.generateWorld();
    } else {
      this.logger.log(
        `🌐 World already exists. Created at ${existingWorld.createdAt}`,
      );
    }
  }

  async generateWorld() {
    const alreadyExists = await this.prisma.world.findFirst();
    if (alreadyExists) {
      this.logger.warn('⚠️ World already exists. Skipping generation.');
      return;
    }

    await this.prisma.tile.deleteMany({});
    this.logger.warn('🧹 Old tiles deleted.');

    await this.prisma.world.create({
      data: { name: 'Genesis', size: WORLD_SIZE },
    });

    this.logger.log('🌍 Starting world generation...');
    await this.createEmptyTiles();

    const hubLocations = await this.placeFactionStructures();
    await this.generateNpcVillages(hubLocations);

    this.logger.log('✅ World generation complete.');
  }

  private assignBiome(x: number, y: number): Biome {
    const noise = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;

    if (noise < 0.2) return Biome.FOREST;
    if (noise < 0.35) return Biome.MOUNTAIN;
    if (noise < 0.5) return Biome.HILLS;
    if (noise < 0.65) return Biome.SWAMP;
    if (noise < 0.8) return Biome.DESERT;
    return Biome.PLAINS;
  }

  private getBiomeBonus(biome: Biome): Prisma.JsonValue | null {
    switch (biome) {
      case Biome.FOREST:
        return { resource: 'wood', modifier: 0.2 };
      case Biome.MOUNTAIN:
        return { resource: 'stone', modifier: 0.2 };
      case Biome.HILLS:
        return { resource: 'gold', modifier: 0.15 };
      case Biome.SWAMP:
        return { resource: 'food', modifier: -0.1 };
      case Biome.DESERT:
        return { resource: 'food', modifier: -0.2 };
      default:
        return null;
    }
  }

  private async createEmptyTiles() {
    const tiles: Prisma.TileCreateManyInput[] = [];
    for (let x = -HALF_WORLD; x < HALF_WORLD; x++) {
      for (let y = -HALF_WORLD; y < HALF_WORLD; y++) {
        const biome = this.assignBiome(x, y);
        const bonus = this.getBiomeBonus(biome);

        tiles.push({
          x,
          y,
          name: `(${x},${y})`,
          type: TileType.EMPTY,
          race: null,
          playerId: null,
          playerName: null,
          metadata: {
            biome,
            ...(bonus ? { bonus } : {}),
          },
        });
      }
    }

    await this.prisma.tile.createMany({ data: tiles });
    this.logger.log(`✅ Created ${tiles.length} base tiles with biomes.`);
  }

  private async placeFactionStructures(): Promise<{ x: number; y: number }[]> {
    const STATIC_RACES = getStaticRaces(WORLD_SIZE);
    const hubs: { x: number; y: number }[] = [];

    for (const race of STATIC_RACES) {
      hubs.push({ x: race.hubX, y: race.hubY });

      await this.prisma.tile.update({
        where: { x_y: { x: race.hubX, y: race.hubY } },
        data: {
          name: race.hubName,
          type: TileType.OUTPOST,
          race: race.name,
          playerId: 'SYSTEM',
          playerName: 'SYSTEM',
          metadata: {
            outpostType: 'HUB',
            description: race.description,
            traits: race.traits,
          },
        },
      });

      for (const outpost of race.outposts) {
        await this.prisma.tile.update({
          where: { x_y: { x: outpost.x, y: outpost.y } },
          data: {
            name: outpost.name,
            type: TileType.OUTPOST,
            race: race.name,
            playerId: 'SYSTEM',
            playerName: 'SYSTEM',
            metadata: {
              outpostType: outpost.type,
            },
          },
        });
      }
    }

    return hubs;
  }

  private async generateNpcVillages(hubLocations: { x: number; y: number }[]) {
    for (let i = 0; i < NPC_VILLAGE_COUNT; i++) {
      const { x, y } = await this.getAvailableCoordinates(hubLocations);
      const nearestHub = this.findNearestHub(x, y, hubLocations);
      const distance = this.getDistance(x, y, nearestHub.x, nearestHub.y);
      const zone = this.classifyZone(distance);
      const metadata: Prisma.JsonObject = this.getNpcMetadata(zone);

      await this.prisma.tile.update({
        where: { x_y: { x, y } },
        data: {
          type: TileType.VILLAGE,
          name: `Bandit Camp ${i + 1}`,
          race: null,
          metadata,
        },
      });
    }
    this.logger.log('🎯 Non-player villages created.');
  }

  // ========================
  // UTILS
  // ========================
  private isNearStructure(
    x: number,
    y: number,
    structures: { x: number; y: number }[],
    minDistance = 5,
  ): boolean {
    return structures.some(
      (struct) => this.getDistance(x, y, struct.x, struct.y) < minDistance,
    );
  }

  private async findValidTile(
    isValid: (tile: Tile | null, x: number, y: number) => boolean,
    maxAttempts = 10,
  ): Promise<{ x: number; y: number }> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { x, y } = this.generatePolarCoordinates();
      if (Math.abs(x) > HALF_WORLD || Math.abs(y) > HALF_WORLD) continue;
      const key = `${x},${y}`;
      if (this.reservedTiles.has(key)) continue;
      const tile = await this.prisma.tile.findUnique({
        where: { x_y: { x, y } },
      });
      if (isValid(tile, x, y)) {
        this.reservedTiles.add(key);
        return { x, y };
      }
    }
    throw new Error('❌ Failed to find valid tile');
  }

  private async getAvailableCoordinates(
    hubs: { x: number; y: number }[] = [],
  ): Promise<{ x: number; y: number }> {
    return this.findValidTile((tile, x, y) => {
      return tile?.type === TileType.EMPTY && !this.isNearStructure(x, y, hubs);
    });
  }

  private generatePolarCoordinates(centerX = 0, centerY = 0, maxRadius = HALF_WORLD) {
    const angle = Math.random() * 2 * Math.PI;
    const radius = Math.sqrt(Math.random()) * maxRadius;
    const x = Math.round(centerX + radius * Math.cos(angle));
    const y = Math.round(centerY + radius * Math.sin(angle));
    return { x, y };
  }

  private findNearestHub(x: number, y: number, hubs: { x: number; y: number }[]) {
    return hubs.reduce((closest, hub) =>
      this.getDistance(x, y, hub.x, hub.y) <
      this.getDistance(x, y, closest.x, closest.y)
        ? hub
        : closest,
    );
  }

  private classifyZone(distance: number): Zone {
    if (distance <= 10) return Zone.CORE;
    if (distance <= 25) return Zone.MID;
    return Zone.OUTER;
  }

  private getNpcMetadata(zone: Zone): Prisma.JsonObject {
    switch (zone) {
      case Zone.CORE:
        return { zone, difficulty: 'EASY', loot: { wood: 100, gold: 50 } };
      case Zone.MID:
        return { zone, difficulty: 'MODERATE', loot: { wood: 200, gold: 150 } };
      case Zone.OUTER:
        return { zone, difficulty: 'HARD', loot: { wood: 400, gold: 300 } };
    }
  }

  private getDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  async getTilesAround(x: number, y: number, radius = 20) {
    if (Math.abs(x) > HALF_WORLD || Math.abs(y) > HALF_WORLD) {
      throw new BadRequestException('Invalid coordinates');
    }

    return this.prisma.tile.findMany({
      where: {
        x: { gte: x - radius, lte: x + radius },
        y: { gte: y - radius, lte: y + radius },
      },
      select: {
        x: true,
        y: true,
        name: true,
        type: true,
        race: true,
        playerName: true,
        metadata: true,
      },
    });
  }
}