import { Controller, Post, Get, HttpCode, Req, UseGuards, Body, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { PunchService } from './punch.service';

const selfScheduleSchema = z.object({
  shiftId: z.number().int().positive('班次ID必填'),
});

// API 打卡控制器（Q9/Q14）：上班/下班打卡 + 今日状态查询
// userId 一律取自 JWT（req.user.id），不接受前端传入，防止越权
@ApiTags('打卡')
@Controller('attendance/punch')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PunchController {
  constructor(private readonly punchService: PunchService) {}

  @Post('clock-in')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async clockIn(@Req() req: any) {
    const data = await this.punchService.clockIn(req.user.id);
    return { code: 0, message: 'ok', data };
  }

  @Post('clock-out')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async clockOut(@Req() req: any) {
    const data = await this.punchService.clockOut(req.user.id);
    return { code: 0, message: 'ok', data };
  }

  @Get('today')
  @RequirePermission('attendance:view')
  async today(@Req() req: any) {
    const data = await this.punchService.getToday(req.user.id);
    return { code: 0, message: 'ok', data };
  }

  @Post('self-schedule')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async selfSchedule(@Req() req: any, @Body() body: unknown) {
    const parsed = selfScheduleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 2001, message: '参数校验失败' });
    }
    const data = await this.punchService.selfSchedule(req.user.id, parsed.data.shiftId);
    return { code: 0, message: 'ok', data };
  }
}
