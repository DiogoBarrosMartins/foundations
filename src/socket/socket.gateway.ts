import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: any) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: any) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: any) {
    return { event: 'pong', data: { msg: 'pong!', received: data } };
  }

  sendResourcesUpdate(villageId: string, resources: any) {
    this.server.emit('resourcesUpdated', { villageId, resources });
  }

  sendTrainingUpdate(villageId: string, task: any) {
    this.server.emit('trainingUpdated', { villageId, task });
  }
}
