import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginRateLimitService } from './login-rate-limit.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionGuard } from './permission.guard';
import { CsrfGuard } from './csrf.guard';
import { SettingsModule } from '../settings/settings.module';
import { CsrfService } from '../common/csrf.service';

@Module({
  imports: [
    // 用 registerAsync + ConfigService 惰性读取密钥，避免在模块顶层(.env 未加载)时拿到空值
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          // expiresIn 的官方类型是 number | ms.StringValue（模板字面量，如 '8h'/'30m'）；
          // 环境变量运行期才可信，这里按目标类型收窄一次，避免签发不带到期的 token。
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') || '8h') as NonNullable<
            JwtModuleOptions['signOptions']
          >['expiresIn'],
        },
      }),
    }),
    SettingsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginRateLimitService,
    JwtAuthGuard,
    PermissionGuard,
    CsrfService,
    CsrfGuard,
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
  exports: [JwtAuthGuard, PermissionGuard, LoginRateLimitService, CsrfService],
})
export class AuthModule {}
