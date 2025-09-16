import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma, RaceName, Tile, TileType as DbTileType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getStaticRaces } from 'src/game/constants/race.constants';
import { PrismaService } from 'src/prisma/prisma.service';

// --- Config (env-friendly defaults) ---
const WORLD_SIZE = Number(process.env.WORLD_SIZE ?? 100);
const HALF_WORLD = Math.floor(WORLD_SIZE / 2);
const NPC_VILLAGE_COUNT = Number(process.env.NPC_VILLAGE_COUNT ?? 20);
const WORLD_SEED = process.env.WORLD_SEED ?? 'babel-genesis';

// --- Deterministic RNG (mulberry32) ---
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStringToInt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}
const RNG = mulberry32(hashStringToInt(WORLD_SEED));

// --- Domain enums (local only) ---
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ========= JSON helpers (type-safe access to Prisma.JsonValue) =========
  private isJsonObject(val: Prisma.JsonValue): val is Prisma.JsonObject {
    return typeof val === 'object' && val !== null && !Array.isArray(val);
  }
  private toTileMetadata(
    meta: Prisma.JsonValue | null | undefined,
  ): { biome?: string; bonus?: unknown; [k: string]: unknown } | null {
    if (meta && this.isJsonObject(meta)) {
      return meta as unknown as { biome?: string; bonus?: unknown; [k: string]: unknown };
    }
    return null;
  }

  // ========= Public API =========

  // Ready-to-render map payload with biome/bonus surfaced
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
        case DbTileType.VILLAGE:
          mappedType = 'village';
          break;
        case DbTileType.OUTPOST:
          mappedType = 'outpost';
          break;
        case DbTileType.EMPTY:
        case DbTileType.SHRINE:
          mappedType = 'resource';
          break;
        default:
          mappedType = 'npc';
      }

      const meta = this.toTileMetadata(t.metadata);

      return {
        x: t.x,
        y: t.y,
        type: mappedType,
        name: t.name,
        owner: t.playerName ?? undefined,
        race: t.race ?? undefined,
        meta,                      // full metadata object (or null)
        biome: meta?.biome ?? null,
        bonus: meta?.bonus ?? null,
      };
    });
  }

  async getAllTiles() {
    return this.prisma.tile.findMany({
      select: { x: true, y: true, type: true, race: true, name: true, metadata: true },
    });
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

  // Player spawn hook
  @OnEvent('player.created')
  async onPlayerCreated(payload: {
    playerId: string;
    playerName: string;
    race: string;
    name: string;
  }) {
    this.logger.log(`[WorldService] Allocating village for ${payload.playerName}`);
    await this.addVillageToTile(payload);
  }

  // Create a player village near race outposts, atomically (safe under concurrency)
  async addVillageToTile(data: {
    race: string;
    playerId: string;
    playerName: string;
    name: string;
  }) {
    const { race, playerId, playerName, name } = data;

    const outposts = await this.prisma.tile.findMany({
      where: { type: DbTileType.OUTPOST, race: race as RaceName },
    });
    if (outposts.length === 0) {
      throw new Error(`[WorldService] No outposts found for race "${race}"`);
    }

    const origin = outposts[Math.floor(RNG() * outposts.length)];
    const spot = await this.findEmptyTileNear(origin.x, origin.y);

    const updated = await this.prisma.tile.updateMany({
      where: { x: spot.x, y: spot.y, type: DbTileType.EMPTY },
      data: {
        name,
        type: DbTileType.VILLAGE,
        race: race as RaceName,
        playerId,
        playerName,
        // JSON field: use DbNull to clear (SQL NULL). Use JsonNull if you prefer JSON null.
        metadata: Prisma.DbNull,
      },
    });

    if (updated.count !== 1) {
      throw new Error('[WorldService] Failed to finalize claimed tile for village.');
    }

    this.eventEmitter.emit('world.village.allocated', {
      x: spot.x,
      y: spot.y,
      playerId,
      race,
      playerName,
      name,
    });

    this.logger.log(
      `[WorldService] Village "${name}" created at (${spot.x}, ${spot.y}) for ${playerName}`,
    );
  }

  // ========= Lifecycle =========

  async onModuleInit(): Promise<void> {
    const existingWorld = await this.prisma.world.findFirst();
    if (!existingWorld) {
      this.logger.warn('[WorldService] No world found. Generating...');
      await this.generateWorld();
    } else {
      this.logger.log(
        `[WorldService] World exists. Created at ${existingWorld.createdAt.toISOString()}`,
      );
    }
  }
async generateWorld() {
  const alreadyExists = await this.prisma.world.findFirst();
  if (alreadyExists) {
    this.logger.warn('[WorldService] World already exists. Skipping generation.');
    return;
  }

  // 1. limpa dados antigos fora de transação longa
  await this.prisma.tile.deleteMany({});
  this.logger.log('[WorldService] Cleared previous tiles.');

  // 2. cria registo do mundo
  await this.prisma.world.create({
    data: { name: 'Genesis', size: WORLD_SIZE, seed: WORLD_SEED },
  });

  // 3. cria tiles em batches (sem $transaction gigante)
  await this.createEmptyTiles(this.prisma);

  // 4. hubs + NPCs podem ir numa transação mais curta
  await this.prisma.$transaction(async (tx) => {
    const hubLocations = await this.placeFactionStructures(tx);
    await this.generateNpcVillages(hubLocations, tx);
  });

  this.logger.log('[WorldService] World generation completed.');
}

  // ========= Generation helpers =========

  private assignBiome(x: number, y: number): Biome {
    // Fast hash-based pseudo-noise (deterministic)
    const noise =
      Math.abs(Math.sin(x * 12.9898 + y * 78.233 + 1337.42)) % 1;

    if (noise < 0.2) return Biome.FOREST;
    if (noise < 0.35) return Biome.MOUNTAIN;
    if (noise < 0.5) return Biome.HILLS;
    if (noise < 0.65) return Biome.SWAMP;
    if (noise < 0.8) return Biome.DESERT;
    return Biome.PLAINS;
  }

  private getBiomeBonus(biome: Biome): Prisma.InputJsonValue | undefined {
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
        return undefined;
    }
  }
private async createEmptyTiles(tx: Prisma.TransactionClient = this.prisma) {
  const tiles: Prisma.TileCreateManyInput[] = [];

  for (let x = -HALF_WORLD; x < HALF_WORLD; x++) {
    for (let y = -HALF_WORLD; y < HALF_WORLD; y++) {
      const biome = this.assignBiome(x, y);
      const bonus = this.getBiomeBonus(biome);

      tiles.push({
        x,
        y,
        name: `(${x},${y})`,
        type: DbTileType.EMPTY,
        race: null,
        playerId: null,
        playerName: null,
        metadata: { biome, ...(bonus ? { bonus } : {}) } as Prisma.InputJsonValue,
      });
    }
  }

  const BATCH_SIZE = 1000;
  for (let i = 0; i < tiles.length; i += BATCH_SIZE) {
    const chunk = tiles.slice(i, i + BATCH_SIZE);
    await tx.tile.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }

  this.logger.log(`[WorldService] Created ${tiles.length} base tiles with biomes.`);
}


  private async placeFactionStructures(
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<{ x: number; y: number }[]> {
    const STATIC_RACES = getStaticRaces(WORLD_SIZE);
    const hubs: { x: number; y: number }[] = [];

    for (const race of STATIC_RACES) {
      hubs.push({ x: race.hubX, y: race.hubY });

      await tx.tile.update({
        where: { x_y: { x: race.hubX, y: race.hubY } },
        data: {
          name: race.hubName,
          type: DbTileType.OUTPOST,
          race: race.name as RaceName,
          playerId: 'SYSTEM',
          playerName: 'SYSTEM',
          metadata: {
            outpostType: 'HUB',
            description: race.description,
            traits: race.traits,
          } as Prisma.InputJsonValue,
        },
      });

      for (const outpost of race.outposts) {
        await tx.tile.update({
          where: { x_y: { x: outpost.x, y: outpost.y } },
          data: {
            name: outpost.name,
            type: DbTileType.OUTPOST,
            race: race.name as RaceName,
            playerId: 'SYSTEM',
            playerName: 'SYSTEM',
            metadata: { outpostType: outpost.type } as Prisma.InputJsonValue,
          },
        });
      }
    }

    return hubs;
  }

  private async generateNpcVillages(
    hubLocations: { x: number; y: number }[],
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    let created = 0;
    let attempts = 0;
    const MAX_ATTEMPTS = NPC_VILLAGE_COUNT * 20;

    while (created < NPC_VILLAGE_COUNT && attempts < MAX_ATTEMPTS) {
      attempts++;
      const { x, y } = await this.getAvailableCoordinates(hubLocations);
      const nearestHub = this.findNearestHub(x, y, hubLocations);
      const distance = this.getDistance(x, y, nearestHub.x, nearestHub.y);
      const zone = this.classifyZone(distance);
      const metadata: Prisma.JsonObject = this.getNpcMetadata(zone);

      const ok = await this.claimEmptyTile(x, y, {
        type: DbTileType.VILLAGE,
        name: `Bandit Camp ${created + 1}`,
        race: null,
        metadata,
      });

      if (ok) created++;
    }

    this.logger.log(
      `[WorldService] Created ${created}/${NPC_VILLAGE_COUNT} NPC villages (attempts=${attempts}).`,
    );
  }

  // ========= Allocation & validation =========

  /** Atomically claim an EMPTY tile at (x,y); returns true if exactly one row updated. */
  private async claimEmptyTile(
    x: number,
    y: number,
    data: Prisma.TileUpdateManyMutationInput,
  ): Promise<boolean> {
    const res = await this.prisma.tile.updateMany({
      where: { x, y, type: DbTileType.EMPTY },
      data,
    });
    return res.count === 1;
  }

  private async findEmptyTileNear(
    originX: number,
    originY: number,
  ): Promise<{ x: number; y: number }> {
    const MAX_RADIUS = 10;
    for (let radius = 1; radius <= MAX_RADIUS; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const x = originX + dx;
          const y = originY + dy;
          const key = `${x},${y}`;
          if (Math.abs(x) > HALF_WORLD || Math.abs(y) > HALF_WORLD) continue;
          if (this.reservedTiles.has(key)) continue;

          const tile = await this.prisma.tile.findUnique({
            where: { x_y: { x, y } },
            select: { type: true },
          });

          if (tile && tile.type === DbTileType.EMPTY) {
            this.reservedTiles.add(key); // soft reservation (in-memory)
            return { x, y };
          }
        }
      }
    }
    throw new Error('[WorldService] Could not find nearby empty tile');
  }

  private async findValidTile(
    isValid: (tile: Tile | null, x: number, y: number) => boolean,
    maxAttempts = 20,
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
    throw new Error('[WorldService] Failed to find valid tile');
  }

  private async getAvailableCoordinates(
    hubs: { x: number; y: number }[] = [],
  ): Promise<{ x: number; y: number }> {
    return this.findValidTile((tile, x, y) => {
      return tile?.type === DbTileType.EMPTY && !this.isNearStructure(x, y, hubs);
    });
  }

  private isNearStructure(
    x: number,
    y: number,
    structures: { x: number; y: number }[],
    minDistance = 5,
  ): boolean {
    return structures.some(
      (s) => this.getDistance(x, y, s.x, s.y) < minDistance,
    );
  }

  private findNearestHub(
    x: number,
    y: number,
    hubs: { x: number; y: number }[],
  ) {
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
        return {
          zone,
          difficulty: 'MODERATE',
          loot: { wood: 200, gold: 150 },
          expansionReward: 'MINOR_BUFF',
        };
      case Zone.OUTER:
        return {
          zone,
          difficulty: 'HARD',
          loot: { wood: 400, gold: 300 },
          expansionReward: 'RARE_RESOURCE',
          eventTrigger: true,
        };
    }
  }

  private getDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  private generatePolarCoordinates(
    centerX = 0,
    centerY = 0,
    maxRadius = HALF_WORLD,
  ) {
    const angle = RNG() * 2 * Math.PI;
    const radius = Math.sqrt(RNG()) * maxRadius;
    const x = Math.round(centerX + radius * Math.cos(angle));
    const y = Math.round(centerY + radius * Math.sin(angle));
    return { x, y };
  }
}
