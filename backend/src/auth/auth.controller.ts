import { Controller, Post, Get, Body, Req, Res, HttpCode, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CsrfService } from '../common/csrf.service';
import { loginSchema, type LoginDto } from './dto/login.dto';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly csrfService: CsrfService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 4000, message: parsed.error.errors[0].message });
    }
    const dto: LoginDto = parsed.data;
    const { username, password } = dto;
    const clientIp = (req.ip || req.headers['x-forwarded-for'] as string || '').split(',')[0].trim();
    const { user, accessToken } = await this.authService.login(username, password, clientIp || undefined);
    const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.header(
      'Set-Cookie',
      `access_token=${accessToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${2 * 60 * 60}${secureFlag}`,
    );
    const csrfToken = await this.csrfService.generateToken(user.id);
    res.header('X-CSRF-Token', csrfToken);
    return { code: 0, message: 'ok', data: { user, csrfToken } };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: FastifyRequest) {
    const { user } = await this.authService.me((req as any).user.id);
    return { code: 0, message: 'ok', data: { user } };
  }

  @Get('csrf-token')
  @UseGuards(JwtAuthGuard)
  async getCsrfToken(@Req() req: FastifyRequest) {
    const userId = (req as any).user.id;
    const token = await this.csrfService.generateToken(userId);
    return { code: 0, message: 'ok', data: { token } };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async changePassword(@Body() body: { oldPassword: string; newPassword: string }, @Req() req: FastifyRequest) {
    if (!body.oldPassword || !body.newPassword) {
      throw new BadRequestException({ code: 4000, message: '参数不完整' });
    }
    await this.authService.changePassword((req as any).user.id, body.oldPassword, body.newPassword);
    return { code: 0, message: '修改成功' };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const userId = (req as any).user.id;
    const token = (req as any).token;
    if (token) {
      await this.authService.logout(token);
    }
    await this.csrfService.invalidateToken(userId);
    res.header(
      'Set-Cookie',
      'access_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
    );
    return { code: 0, message: '已退出登录' };
  }
}
