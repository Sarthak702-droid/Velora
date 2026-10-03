import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(','),
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers.authorization || client.handshake.auth?.token;
      if (!authHeader) { client.disconnect(true); return; }
      if (authHeader) {
        const token = authHeader.replace(/^Bearer\s+/, '');
        const payload = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET || 'velora_super_secure_production_ready_jwt_secret_2026_x99',
        });
        if (!['SALON_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'PROFESSIONAL'].includes(payload.role) || !payload.tenantId) {
          client.disconnect(true); return;
        }
        (client as any).user = payload;
        if (payload.tenantId) {
          client.join(`tenant:${payload.tenantId}`);
        }
        if (payload.branchId) {
          client.join(`branch:${payload.branchId}`);
          client.join(`queue:${payload.branchId}`);
        }
      }
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe_queue')
  handleSubscribeQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { branchId: string; tenantId: string },
  ) {
    const user = (client as any).user;
    if (data?.branchId && user?.tenantId === data.tenantId && user.branchId === data.branchId) {
      client.join(`queue:${data.branchId}`);
      return { status: 'subscribed', room: `queue:${data.branchId}` };
    }
  }

  @SubscribeMessage('subscribe_token')
  handleSubscribeToken(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tokenNumber: string },
  ) {
    return { status: 'denied', message: 'Use the private receipt HTTP endpoint for customer tracking' };
  }

  // Domain event broadcasters
  broadcastQueueUpdated(branchId: string, payload: any) {
    this.server.to(`queue:${branchId}`).emit('QUEUE_UPDATED', payload);
  }

  broadcastTokenUpdated(tokenNumber: string, payload: any) {
    this.server.to(`token:${tokenNumber}`).emit('TOKEN_UPDATED', payload);
  }

  broadcastTimelineUpdated(branchId: string, payload: any) {
    this.server.to(`branch:${branchId}`).emit('TIMELINE_UPDATED', payload);
  }

  broadcastStaffStatusChanged(branchId: string, payload: any) {
    this.server.to(`branch:${branchId}`).emit('STAFF_STATUS_CHANGED', payload);
  }
}
