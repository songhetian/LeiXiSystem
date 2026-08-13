import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginRateLimitService } from './login-rate-limit.service';
import * as bcrypt from 'bcryptjs';

export interface JwtPayload {
  sub: number;
  username: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly rateLimit: LoginRateLimitService,
  ) {}

  async login(username: string, password: string) {
    // 登录限流：超限直接拒绝，不查库、不暴露账号是否存在（T22.4）
    await this.rateLimit.assertNotBlocked(username);

    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      // 失败计数（Redis 未启用时直通）
      await this.rateLimit.registerFailure(username);
      throw new UnauthorizedException({ code: 5001, message: '用户名或密码错误' });
    }
    // 成功清零计数
    await this.rateLimit.reset(username);
    const payload: JwtPayload = { sub: user.id, username: user.username };
    const accessToken = await this.jwt.signAsync(payload);
    return { user: this.toPublicUser(user), accessToken };
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user) throw new UnauthorizedException({ code: 5002, message: 'token 无效或过期' });
    return { user: this.toPublicUser(user) };
  }

  private toPublicUser(user: any) {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      permissions: Array.from(
        new Set(
          user.roles.flatMap((ur: any) =>
            ur.role.permissions.map((rp: any) => rp.permission.code),
          ),
        ),
      ),
    };
  }
}
