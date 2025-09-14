import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { hash, compare } from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { LoginPlayerDto } from './dto/login-player.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface JwtPayload {
  sub: string;
}

@Injectable()
export class PlayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private generateToken(playerId: string): string {
    return jwt.sign({ sub: playerId }, process.env.JWT_SECRET!, {
      expiresIn: '7d',
    });
  }

  async validateToken(token: string) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      const payload = decoded as JwtPayload;

      const player = await this.prisma.player.findUnique({
        where: { id: payload.sub },
      });

      if (!player) throw new UnauthorizedException('Player not found');

      return { playerId: player.id, username: player.username };
    } catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token expired');
      }
      throw new UnauthorizedException('Invalid token');
    }
  }

  async create(dto: CreatePlayerDto) {
    const existing = await this.prisma.player.findUnique({
      where: { username: dto.username },
    });
    if (existing) throw new BadRequestException('Username already taken');

    const hashedPassword = await hash(dto.password, 10);

    const player = await this.prisma.player.create({
      data: {
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        race: dto.race, // ✅ enum direto
      },
    });

    const token = this.generateToken(player.id);

    // 🔥 Dispara evento
    this.eventEmitter.emit('player.created', {
      playerId: player.id,
      playerName: player.username,
      race: player.race, // ✅ já vem do enum
      name: `${player.username}'s Village`,
    });

    return { player, token };
  }

  async login(dto: LoginPlayerDto) {
    const player = await this.prisma.player.findUnique({
      where: { username: dto.username },
    });
    if (!player) throw new UnauthorizedException('Invalid credentials');

    const match = await compare(dto.password, player.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    const token = this.generateToken(player.id);
    return { player, token };
  }

  findAll() {
    return this.prisma.player.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.player.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async update(id: string, dto: UpdatePlayerDto) {
    const data: any = {};

    if (dto.username) data.username = dto.username;
    if (dto.password) data.password = await hash(dto.password, 10);
    if (dto.race) data.race = dto.race; // ✅ já não é raceId

    return this.prisma.player.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string) {
    await this.prisma.player.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Player marked as deleted' };
  }
}
