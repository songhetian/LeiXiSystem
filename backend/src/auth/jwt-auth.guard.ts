import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// 从 httpOnly cookie（access_token）解析并校验 JWT（E1：SameSite=Lax）
// 手动解析 cookie 头：@fastify/cookie 的 req.cookies 在 Nest FastifyAdapter 下不可靠
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const cookieHeader: string | undefined = req.headers?.cookie;
    const token = cookieHeader
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('access_token='))
      ?.split('=')[1];
    if (!token) {
      throw new UnauthorizedException({ code: 5002, message: '未登录或 token 缺失' });
    }
    try {
      const payload = await this.jwt.verifyAsync(token);
      req.user = { id: payload.sub, username: payload.username };
      return true;
    } catch {
      throw new UnauthorizedException({ code: 5002, message: 'token 无效或过期' });
    }
  }
}
