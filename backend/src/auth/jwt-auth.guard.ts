import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../common/redis/redis.service';
import { ERROR_CODES } from '../common/error-codes';

function blacklistKey(jti: string): string {
  return `auth:blacklist:${jti}`;
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
    try {
      const payload = await this.jwt.verifyAsync(token);
      // 检查 token 是否已被加入黑名单（退出登录）
      if (payload.jti && this.redis.isEnabled) {
        const blacklisted = await this.redis.get(blacklistKey(payload.jti));
        if (blacklisted) {
          throw new UnauthorizedException({
            code: ERROR_CODES.AUTH_TOKEN_INVALID,
            message: 'token 已失效，请重新登录',
          });
        }
      }
      req.user = { id: payload.sub, username: payload.username };
      req.token = token;
      return true;
    } catch {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_TOKEN_INVALID,
        message: 'token 无效或过期',
      });
    }
  }
}
