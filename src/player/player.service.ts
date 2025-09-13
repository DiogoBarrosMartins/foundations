import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { LoginPlayerDto } from './dto/login-player.dto';

import * as jwt from 'jsonwebtoken';
import { hash, compare } from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';

interface JwtPayload {
  sub: string;
}

@Injectable()
export class PlayerService {
  constructor(private readonly prisma: PrismaService) {}

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
      data: { ...dto, password: hashedPassword },
    });

    const token = this.generateToken(player.id);
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

  update(id: string, data: UpdatePlayerDto) {
    return this.prisma.player.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    await this.prisma.player.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Player marked as deleted' };
  }
}
