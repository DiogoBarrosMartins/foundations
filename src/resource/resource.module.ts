import { Module } from '@nestjs/common';
import { ResourceService } from './resource.service';
import { ResourceController } from './resource.controller';

import { SocketModule } from '../socket/socket.module';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [SocketModule],
  controllers: [ResourceController],
  providers: [ResourceService, PrismaService],
  exports: [ResourceService],
})
export class ResourceModule {}
