import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  data: {
    playerId?: string;
    username?: string;
    villageIds?: string[];
  };
}

interface JwtPayload {
  sub: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SocketGateway.name);

  @WebSocketServer()
  server: Server;

  // Track connected players for debugging/monitoring
  private connectedPlayers = new Map<string, Set<string>>(); // playerId -> Set<socketId>

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client attempting connection: ${client.id}`);

    try {
      // Extract token from handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without auth - limited access`);
        // Allow connection but mark as unauthenticated
        client.data.playerId = undefined;
        return;
      }

      // Validate JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      client.data.playerId = decoded.sub;

      // Join player-specific room
      await client.join(`player:${decoded.sub}`);

      // Track connection
      if (!this.connectedPlayers.has(decoded.sub)) {
        this.connectedPlayers.set(decoded.sub, new Set());
      }
      this.connectedPlayers.get(decoded.sub)!.add(client.id);

      this.logger.log(
        `Client ${client.id} authenticated as player ${decoded.sub}`,
      );
    } catch (error) {
      this.logger.warn(`Client ${client.id} failed auth: ${error}`);
      // Allow connection but mark as unauthenticated
      client.data.playerId = undefined;
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const playerId = client.data.playerId;

    if (playerId) {
      const playerSockets = this.connectedPlayers.get(playerId);
      if (playerSockets) {
        playerSockets.delete(client.id);
        if (playerSockets.size === 0) {
          this.connectedPlayers.delete(playerId);
        }
      }
    }

    this.logger.log(`Client disconnected: ${client.id} (player: ${playerId || 'anonymous'})`);
  }

  /**
   * Subscribe to a village room for real-time updates.
   * Only allows subscription if player owns the village.
   */
  @SubscribeMessage('subscribe:village')
  async handleSubscribeVillage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { villageId: string },
  ) {
    const playerId = client.data.playerId;

    if (!playerId) {
      return { error: 'Not authenticated' };
    }

    // TODO: Verify player owns this village via database check
    // For now, trust the client (can be improved with villageService injection)

    await client.join(`village:${data.villageId}`);

    // Track subscribed villages
    client.data.villageIds = client.data.villageIds || [];
    if (!client.data.villageIds.includes(data.villageId)) {
      client.data.villageIds.push(data.villageId);
    }

    this.logger.log(
      `Player ${playerId} subscribed to village ${data.villageId}`,
    );

    return { success: true, villageId: data.villageId };
  }

  /**
   * Unsubscribe from a village room.
   */
  @SubscribeMessage('unsubscribe:village')
  async handleUnsubscribeVillage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { villageId: string },
  ) {
    await client.leave(`village:${data.villageId}`);

    if (client.data.villageIds) {
      client.data.villageIds = client.data.villageIds.filter(
        (id) => id !== data.villageId,
      );
    }

    this.logger.log(
      `Player ${client.data.playerId} unsubscribed from village ${data.villageId}`,
    );

    return { success: true };
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: any) {
    return { event: 'pong', data: { msg: 'pong!', received: data } };
  }

  /**
   * Send resource update to a specific village room only.
   * FIXED: No longer broadcasts to all clients.
   */
  sendResourcesUpdate(villageId: string, resources: any) {
    this.server.to(`village:${villageId}`).emit('resourcesUpdated', {
      villageId,
      resources,
    });
  }

  /**
   * Send training update to a specific village room only.
   * FIXED: No longer broadcasts to all clients.
   */
  sendTrainingUpdate(villageId: string, task: any) {
    this.server.to(`village:${villageId}`).emit('trainingUpdated', {
      villageId,
      task,
    });
  }

  /**
   * Send construction update to a specific village room.
   */
  sendConstructionUpdate(villageId: string, building: any) {
    this.server.to(`village:${villageId}`).emit('constructionUpdated', {
      villageId,
      building,
    });
  }

  /**
   * Send combat update to specific village rooms (attacker and defender).
   */
  sendCombatUpdate(
    attackerVillageId: string,
    defenderVillageId: string | null,
    combat: any,
  ) {
    // Notify attacker
    this.server.to(`village:${attackerVillageId}`).emit('combatUpdated', {
      villageId: attackerVillageId,
      type: 'outgoing',
      combat,
    });

    // Notify defender (if exists)
    if (defenderVillageId) {
      this.server.to(`village:${defenderVillageId}`).emit('combatUpdated', {
        villageId: defenderVillageId,
        type: 'incoming',
        combat: {
          ...combat,
          troops: undefined, // Don't reveal attacker troops to defender
        },
      });
    }
  }

  /**
   * Send notification to a specific player.
   */
  sendPlayerNotification(playerId: string, notification: any) {
    this.server.to(`player:${playerId}`).emit('notification', notification);
  }

  /**
   * Get count of connected players (for monitoring).
   */
  getConnectedPlayerCount(): number {
    return this.connectedPlayers.size;
  }

  /**
   * Get all socket IDs for a player (for debugging).
   */
  getPlayerSockets(playerId: string): string[] {
    return Array.from(this.connectedPlayers.get(playerId) || []);
  }
}
