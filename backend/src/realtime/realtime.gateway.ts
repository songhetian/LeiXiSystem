import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../common/redis/redis.service';

/**
 * Payload emitted by NotificationService on the `notification.created` event.
 * The `create()` path includes the full DB row (with `id`); the `createMany()`
 * path emits `{ userId, ...params }` without an `id`.
 */
interface NotificationPayload {
  id?: number;
  userId: number;
  title: string;
  content?: string;
  type?: string;
  relatedId?: number;
  relatedType?: string;
}

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:8088,http://localhost:3000').split(','),
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Called for every new Socket.IO connection. Extracts the JWT from either
   * `auth.token` or the `Authorization` header, verifies it, and joins the
   * client to a per-user room (`user:<userId>`) so targeted pushes work.
   *
   * If the token is missing or invalid the connection is rejected.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ||
        this.extractBearerToken(
          client.handshake.headers?.authorization as string | undefined,
        ) ||
        this.extractTokenFromCookie(
          client.handshake.headers?.cookie as string | undefined,
        );

      if (!token) {
        this.logger.warn(
          `Client ${client.id} connected without a token — disconnecting`,
        );
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        username: string;
      }>(token);

      const userId = payload?.sub;
      if (!userId) {
        this.logger.warn(
          `Client ${client.id} token had no sub claim — disconnecting`,
        );
        client.disconnect();
        return;
      }

      const jti = (payload as { jti?: string }).jti;
      if (jti && this.redis.isEnabled) {
        const blacklisted = await this.redis.get(`auth:blacklist:${jti}`);
        if (blacklisted) {
          this.logger.warn(
            `Client ${client.id} token is blacklisted — disconnecting`,
          );
          client.disconnect();
          return;
        }
      }

      // Stash for debugging / disconnect logging.
      (client.data as Record<string, unknown>).userId = userId;
      await client.join(`user:${userId}`);
      this.logger.log(
        `Client ${client.id} joined room user:${userId} (user=${payload.username})`,
      );
    } catch (err) {
      this.logger.warn(
        `Client ${client.id} failed JWT verification — disconnecting: ${err instanceof Error ? err.message : String(err)}`,
      );
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = (client.data as Record<string, unknown> | undefined)?.userId;
    this.logger.log(
      `Client ${client.id} disconnected${userId !== undefined ? ` (user:${userId})` : ''}`,
    );
  }

  /**
   * Listens for the internal `notification.created` event emitted by
   * NotificationService and pushes the payload to the recipient's room via
   * Socket.IO. Wrapped in try/catch so a transient Socket.IO failure never
   * breaks the business operation that originated the notification.
   */
  @OnEvent('notification.created')
  handleNotificationCreated(payload: NotificationPayload): void {
    try {
      if (!this.server || !payload?.userId) {
        return;
      }
      this.server
        .to(`user:${payload.userId}`)
        .emit('notification', payload);
    } catch (err) {
      this.logger.error(
        `Failed to push notification via WebSocket: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * 单设备登录（Q16）：当 AuthService 检测到同账号在新设备登录时，
   * 通过 NestJS EventEmitter 发出 `auth.session_replaced` 事件。
   * 本方法将 kicked_out 事件推送到旧设备的 Socket.IO room，
   * 前端收到后断开连接、提示用户并跳转到登录页。
   */
  @OnEvent('auth.session_replaced')
  handleSessionReplaced(payload: { userId: number; message?: string }): void {
    try {
      if (!this.server || !payload?.userId) {
        return;
      }
      this.server
        .to(`user:${payload.userId}`)
        .emit('kicked_out', {
          userId: payload.userId,
          message: payload.message ?? '您的账号在其他设备登录，已被迫下线',
        });
      this.logger.log(
        `Emitted kicked_out to user:${payload.userId}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to emit kicked_out: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * 用户退出登录时，主动断开该用户所有 WebSocket 连接。
   * 由 AuthService.logout() 发出 auth.logout 事件触发。
   */
  @OnEvent('auth.logout')
  handleLogout(payload: { userId: number }): void {
    try {
      if (!this.server || !payload?.userId) {
        return;
      }
      this.server.in(`user:${payload.userId}`).disconnectSockets(true);
      this.logger.log(
        `Disconnected all sockets for user:${payload.userId} (logout)`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to disconnect sockets on logout: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private extractBearerToken(header?: string): string | undefined {
    if (!header) return undefined;
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : undefined;
  }

  /**
   * 从 Cookie 头中提取 access_token（HttpOnly cookie 无法被 JS 读取，
   * 但 Socket.IO 的 handshake 会携带 cookie，服务端可在此解析）。
   */
  private extractTokenFromCookie(cookieHeader?: string): string | undefined {
    if (!cookieHeader) return undefined;
    const match = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('access_token='));
    if (!match) return undefined;
    return decodeURIComponent(match.slice('access_token='.length));
  }
}
