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
// generateWorld.ts
async generateWorld() {
  this.logger.warn("[WorldService] No world found. Generating...");

  const WORLD_SIZE = 100;
  const seed = Date.now();

  // 1. limpar mundo antigo
  this.logger.log("[WorldService] Cleared previous tiles.");
  await this.prisma.tile.deleteMany();
  await this.prisma.world.deleteMany();

  // 2. criar novo world
  const world = await this.prisma.world.create({
    data: { name: "Babel World",size: WORLD_SIZE, seed: seed.toString() },
  });

  // 3. criar tiles vazios em batches
  await this.createEmptyTiles(world.id, WORLD_SIZE);

  // 4. hubs e outposts de raças
  await this.placeRaceStructures(world.id);

  // 5. aldeias NPC
  await this.spawnNpcVillages(world.id);

  this.logger.log("[WorldService] 🌍 World generation complete.");
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
private async createEmptyTiles(worldId: string, size: number) {
  const batchSize = 1000;
  const tiles: any[] = [];

  for (let x = -size / 2; x < size / 2; x++) {
    for (let y = -size / 2; y < size / 2; y++) {
      tiles.push({
        worldId,
        x,
        y,
        type: DbTileType.EMPTY,  // 👈 não "empty"
  metadata: {
    biome: this.assignBiome(x, y),
    bonus: this.getBiomeBonus(this.assignBiome(x, y)),
  },
      });
    }
  }

  // inserir em batches para não rebentar
  for (let i = 0; i < tiles.length; i += batchSize) {
    const chunk = tiles.slice(i, i + batchSize);
    await this.prisma.tile.createMany({ data: chunk });
    this.logger.log(
      `[WorldService] Created ${i + chunk.length}/${tiles.length} base tiles`
    );
  }
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
  private rand(min: number, max: number) {
  return Math.floor(RNG() * (max - min + 1)) + min;
}
private async placeRaceStructures(worldId: string) {
  const races = getStaticRaces(WORLD_SIZE);

  for (const race of races) {
    // Hub principal (tipo = OUTPOST, marcado como hub no metadata)
    const hub = await this.prisma.tile.create({
      data: {
        worldId,
        x: race.hubX,
        y: race.hubY,
        type: DbTileType.OUTPOST, // 👈 corrigido (era VILLAGE)
        race: race.name as RaceName, // 👈 garantir que fica associado à raça
        name: race.hubName,
        playerId: "SYSTEM",
        playerName: "SYSTEM",
        metadata: {
          race: race.name,
          hub: true,
          description: race.description,
          traits: race.traits,
        },
      },
    });

    this.logger.log(`🏰 ${race.name} hub '${race.hubName}' placed at (${hub.x}, ${hub.y})`);

    // Outposts secundários
    for (const outpost of race.outposts) {
      const op = await this.prisma.tile.create({
        data: {
          worldId,
          x: outpost.x,
          y: outpost.y,
          type: DbTileType.OUTPOST,
          race: race.name as RaceName, // 👈 associar também à raça
          name: outpost.name,
          playerId: "SYSTEM",
          playerName: "SYSTEM",
          metadata: { outpostType: outpost.type },
        },
      });
      this.logger.log(`🏕️ ${race.name} outpost '${op.name}' placed at (${op.x}, ${op.y})`);
    }
  }
}

private async spawnNpcVillages(worldId: string) {
  let placed = 0;
  let attempts = 0;
  const target = 20;

  while (placed < target && attempts < target * 5) {
    attempts++;
    const x = this.rand(-50, 50);
    const y = this.rand(-50, 50);

    const exists = await this.prisma.tile.findUnique({
      where: { x_y: { x, y } }, // 👈 índice correto
    });

    if (!exists) {
      await this.prisma.tile.create({
        data: {
          worldId,
          x,
          y,
          type: DbTileType.VILLAGE, // 👈 enum válido (NPCs tratados como aldeias especiais)
          name: `NPC Village ${placed + 1}`,
          metadata: { npc: true }, // 👈 marca no metadata que é NPC
        },
      });
      placed++;
    }
  }

  this.logger.log(`[WorldService] Created ${placed}/${target} NPC villages (attempts=${attempts}).`);
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
