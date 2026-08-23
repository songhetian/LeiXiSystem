import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { SettingsService } from '../settings/settings.service';
import { LoginRateLimitService } from './login-rate-limit.service';
import { validatePasswordStrength, PasswordStrengthLevel } from '../common/password-strength.util';
import { ERROR_CODES } from '../common/error-codes';
import { PermissionCacheService } from '../common/permission-cache.service';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { User, UserRole, Role, RolePermission, Permission } from '@prisma/client';

const PASSWORD_STRENGTH_SETTING_KEY = 'password_strength_level';
const DEFAULT_PASSWORD_STRENGTH_LEVEL: PasswordStrengthLevel = 'medium';

type UserRoleWithRole = UserRole & {
  role: Role & {
    permissions: (RolePermission & { permission: Permission })[];
  };
};

type UserWithRoles = User & {
  roles: UserRoleWithRole[];
};

export interface PublicUser {
  id: number;
  username: string;
  name: string;
  permissions: string[];
}

export interface JwtPayload {
  sub: number;
  username: string;
  jti: string;
  exp?: number;
  iat?: number;
}

/**
 * JWT 默认过期时间（秒）。与 auth.module.ts 中 JwtModule.register 的 signOptions 对齐。
 * 用于 Redis session key 的 TTL，确保会话记录与 JWT 同步过期。
 */
const JWT_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly rateLimit: LoginRateLimitService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly settingsService: SettingsService,
    private readonly permCache: PermissionCacheService,
  ) {}

  /**
   * 单设备登录 key：user:session:{userId}
   * 存储当前有效的 JWT token，TTL 与 JWT 过期时间一致。
   */
  private sessionKey(userId: number): string {
    return `user:session:${userId}`;
  }

  async login(username: string, password: string, ip?: string) {
    // 登录限流：超限直接拒绝，不查库、不暴露账号是否存在（T22.4）
    await this.rateLimit.assertNotBlocked(username, ip);

    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      // 失败计数（Redis 未启用时直通）
      await this.rateLimit.registerFailure(username, ip);
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        message: '用户名或密码错误',
      });
    }
    // 成功清零计数
    await this.rateLimit.reset(username);
    const jti = randomUUID();
    const payload: JwtPayload = { sub: user.id, username: user.username, jti };
    const accessToken = await this.jwt.signAsync(payload);

    // 单设备登录（Q16）：检查 Redis 中是否已有会话，如有则踢旧会话
    if (this.redis.isEnabled) {
      const existingToken = await this.redis.get(this.sessionKey(user.id));
      if (existingToken && existingToken !== accessToken) {
        // 旧会话存在且 token 不同 → 发出 kicked_out 事件
        this.eventEmitter.emit('auth.session_replaced', {
          userId: user.id,
          message: '您的账号在其他设备登录，已被迫下线',
        });
      }
      // 存储/覆盖当前 session
      await this.redis.set(
        this.sessionKey(user.id),
        accessToken,
        JWT_EXPIRES_IN_SECONDS,
      );
    }

    return { user: this.toPublicUser(user), accessToken };
  }

  private blacklistKey(jti: string): string {
    return `auth:blacklist:${jti}`;
  }

  async logout(token: string) {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      if (this.redis.isEnabled) {
        const exp = payload.exp;
        const ttl = exp ? Math.max(1, exp - Math.floor(Date.now() / 1000)) : JWT_EXPIRES_IN_SECONDS;
        await this.redis.set(this.blacklistKey(payload.jti), '1', ttl);
      }
      this.eventEmitter.emit('auth.logout', { userId: payload.sub });
    } catch {
      // token 无效就不用加黑名单了
    }
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    if (!this.redis.isEnabled) return false;
    const val = await this.redis.get(this.blacklistKey(jti));
    return val !== null;
  }

  async invalidateUserPermCache(userId: number) {
    await this.permCache.invalidateUser(userId);
  }

  async me(userId: number) {
    const user = await this.permCache.getUserInfo(userId);
    return { user };
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException({
      code: ERROR_CODES.AUTH_TOKEN_INVALID,
      message: '用户不存在',
    });
    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) throw new ForbiddenException({
      code: ERROR_CODES.DATA_NO_PERMISSION,
      message: '原密码错误',
    });
    await this.validatePassword(newPassword, user.username);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    if (this.redis.isEnabled) {
      await this.redis.del(this.sessionKey(userId));
    }
    return true;
  }

  private toPublicUser(user: UserWithRoles): PublicUser {
    const permissions: string[] = [];
    for (const ur of user.roles) {
      for (const rp of ur.role.permissions) {
        permissions.push(rp.permission.code);
      }
    }
    return {
      id: user.id,
      username: user.username,
      name: user.realName,
      permissions: Array.from(new Set(permissions)),
    };
  }

  private async getPasswordStrengthLevel(): Promise<PasswordStrengthLevel> {
    try {
      const setting = await this.settingsService.get(PASSWORD_STRENGTH_SETTING_KEY);
      const value = setting.value;
      if (['weak', 'medium', 'strong'].includes(value)) {
        return value as PasswordStrengthLevel;
      }
      return DEFAULT_PASSWORD_STRENGTH_LEVEL;
    } catch {
      return DEFAULT_PASSWORD_STRENGTH_LEVEL;
    }
  }

  private async validatePassword(password: string, username?: string): Promise<void> {
    const level = await this.getPasswordStrengthLevel();
    const result = validatePasswordStrength(password, { level, username });
    if (!result.valid) {
      throw new BadRequestException({
        code: ERROR_CODES.SYSTEM_USER_PASSWORD_WEAK,
        message: result.errors.join('；'),
      });
    }
  }
}
