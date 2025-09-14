import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PlayerService } from '../player/player.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly playerService: PlayerService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'];

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = auth.slice(7); // remove "Bearer "
    const result = await this.playerService.validateToken(token);

    req.user = result; // { playerId, username }
    return true;
  }
}
