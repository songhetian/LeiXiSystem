import { Controller, Post, Get, Body, Req, Res, HttpCode, UseGuards, UnauthorizedException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().min(1, '用户名必填'),
  password: z.string().min(1, '密码必填'),
});

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new UnauthorizedException({ code: 5001, message: '用户名或密码错误' });
    }
    const { username, password } = parsed.data;
    const { user, accessToken } = await this.authService.login(username, password);
    // E1：httpOnly + SameSite=Lax，access token 2h（手动 Set-Cookie，兼容 fastify inject）
    res.header(
      'Set-Cookie',
      `access_token=${accessToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${2 * 60 * 60}`,
    );
    return { code: 0, message: 'ok', data: { user } };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: FastifyRequest) {
    const { user } = await this.authService.me((req as any).user.id);
    return { code: 0, message: 'ok', data: { user } };
  }
}
