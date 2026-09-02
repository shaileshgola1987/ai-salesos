import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/jwt-payload.interface';

function orgRoom(organizationId: string) {
  return `org:${organizationId}`;
}

/**
 * Pushes WhatsApp Inbox updates (new messages, status changes) to connected clients so
 * inbound webhook traffic shows up live instead of requiring a manual reload (PRD §22 —
 * NestJS + WebSocket for real-time notifications).
 *
 * Auth happens on connection (not via JwtAuthGuard, which is HTTP-only): the client sends
 * its JWT as `auth.token` on the socket.io handshake; sockets that fail verification are
 * dropped immediately and join no room.
 */
@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:3000' },
  namespace: 'whatsapp',
})
export class WhatsAppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WhatsAppGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwt: JwtService) {}

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth as { token?: string } | undefined)?.token ??
      (client.handshake.query.token as string | undefined);

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      void client.join(orgRoom(payload.organizationId));
    } catch {
      this.logger.warn(`Rejected WhatsApp socket: invalid token`);
      client.disconnect(true);
    }
  }

  handleDisconnect() {
    // Rooms are cleaned up automatically by socket.io on disconnect.
  }

  messageCreated(organizationId: string, message: unknown) {
    this.server?.to(orgRoom(organizationId)).emit('message.created', message);
  }

  messageUpdated(organizationId: string, message: unknown) {
    this.server?.to(orgRoom(organizationId)).emit('message.updated', message);
  }

  conversationUpdated(organizationId: string, conversation: unknown) {
    this.server?.to(orgRoom(organizationId)).emit('conversation.updated', conversation);
  }
}
