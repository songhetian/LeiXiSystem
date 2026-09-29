import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../common/redis/redis.service';
import { ERROR_CODES } from '../common/error-codes';

function blacklistKey(jti: string): string {
  return `auth:blacklist:${jti}`;
}

/** 单设备登录会话 key，与 AuthService.login() 写入的 key 保持一致。 */
function sessionKey(userId: number): string {
  return `user:session:${userId}`;
}

// 从 httpOnly cookie（access_token）解析并校验 JWT（E1：SameSite=Lax）
// 手动解析 cookie 头：@fastify/cookie 的 req.cookies 在 Nest FastifyAdapter 下不可靠
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const cookieHeader: string | undefined = req.headers?.cookie;
    const token = cookieHeader
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('access_token='))
      ?.split('=')[1];
    if (!token) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_TOKEN_INVALID,
        message: '未登录或 token 缺失',
      });
    }

    let payload: { sub: number; username: string; jti?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_TOKEN_INVALID,
        message: 'token 无效或过期',
      });
    }

    // RedisService.get 内部已 try/catch 降级（Redis 不可用时返回 null），不会抛出
    if (this.redis.isEnabled) {
      // 已退出登录的 token 进黑名单
      if (payload.jti) {
        const blacklisted = await this.redis.get(blacklistKey(payload.jti));
        if (blacklisted) {
          throw new UnauthorizedException({
            code: ERROR_CODES.AUTH_TOKEN_INVALID,
            message: 'token 已失效，请重新登录',
          });
        }
      }
      // 单设备登录（Q16）：Redis 中登记的会话 token 与请求 token 不一致，
      // 说明账号已在其他设备登录、或改密后重新登录，当前 token 立即失效。
      // 会话 key 不存在时放行（Redis 重启/清空后不误踢全部在线用户）。
      if (payload.sub) {
        const activeToken = await this.redis.get(sessionKey(payload.sub));
        if (activeToken && activeToken !== token) {
          throw new UnauthorizedException({
            code: ERROR_CODES.AUTH_TOKEN_INVALID,
            message: '您的账号在其他设备登录，已被迫下线',
          });
        }
      }
    }

    req.user = { id: payload.sub, username: payload.username };
    req.token = token;
    return true;
  }
}
