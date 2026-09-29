import {
  Controller,
  Get,
  Put,
  Body,
  HttpCode,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { AttendanceSettingsService } from './settings.service';
import { ERROR_CODES } from '../common/error-codes';
import type { RequestContext } from '../types/fastify';

// Zod schema for PUT /attendance/settings body – all fields optional (partial update)
// 仅允许写到实际被业务消费的 5 项；其余预留项已清理
const updateSettingsSchema = z.object({
  lateThreshold: z.number().int().min(0).optional(),
  earlyThreshold: z.number().int().min(0).optional(),
  earlyClockInMinutes: z.number().int().min(0).optional(),
  makeupDaysLimit: z.number().int().min(0).optional(),
  makeupMonthlyLimit: z.number().int().min(0).optional(),
});

@Controller('attendance/settings')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AttendanceSettingsController {
  constructor(
    private readonly attendanceSettingsService: AttendanceSettingsService,
  ) {}

  /**
   * GET /attendance/settings
   * Returns all global attendance settings (admin view).
   */
  @Get()
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async getSettings() {
    const data = await this.attendanceSettingsService.getSettings();
    return { code: 0, message: 'ok', data };
  }

  /**
   * PUT /attendance/settings
   * Updates global attendance settings.
   * Requires 'attendance:manage' permission (enforced by @RequirePermission).
   */
  @Put()
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async updateSettings(@Body() body: unknown, @Req() req: RequestContext) {
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ERROR_CODES.PARAM_INVALID,
        message: parsed.error.issues[0]?.message ?? '参数校验失败',
      });
    }
    const data = await this.attendanceSettingsService.updateSettings(
      parsed.data,
      req.user.id,
    );
    return { code: 0, message: 'ok', data };
  }
}
