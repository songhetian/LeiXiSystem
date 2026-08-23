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

// Zod schema for PUT /attendance/settings body – all fields optional (partial update)
const updateSettingsSchema = z.object({
  lateThreshold: z.number().int().min(0).optional(),
  earlyThreshold: z.number().int().min(0).optional(),
  earlyClockInMinutes: z.number().int().min(0).optional(),
  lateClockOutMinutes: z.number().int().min(0).optional(),
  absentHours: z.number().min(0).optional(),
  maxAnnualLeaveDays: z.number().int().min(0).optional(),
  maxSickLeaveDays: z.number().int().min(0).optional(),
  requireProofForSickLeave: z.boolean().optional(),
  requireApprovalForOvertime: z.boolean().optional(),
  minOvertimeHours: z.number().min(0).optional(),
  maxOvertimeHoursPerDay: z.number().min(0).optional(),
  allowMakeup: z.boolean().optional(),
  makeupDeadlineDays: z.number().int().min(0).optional(),
  requireApprovalForMakeup: z.boolean().optional(),
  notifyOnLate: z.boolean().optional(),
  notifyOnEarlyLeave: z.boolean().optional(),
  notifyOnAbsent: z.boolean().optional(),
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
  async updateSettings(@Body() body: unknown, @Req() req: any) {
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 2007,
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
