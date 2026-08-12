import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
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
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException({ code: 5001, message: '用户名或密码错误' });
    }
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
