import { Controller, Get, Req, UseGuards, Query } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { DashboardService } from './dashboard.service';
import type { RequestContext } from '../types/fastify';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  // 工作台统计含全公司考勤聚合（出勤/迟到/加班），按考勤查看权限收口
  @RequirePermission('attendance:view')
  async getStats(@Req() req: RequestContext) {
    const stats = await this.dashboardService.getStats(req.user.id);
    return { code: 0, data: stats };
  }

  @Get('attendance-trend')
  @RequirePermission('attendance:view')
  async getAttendanceTrend(@Query('days') days?: string) {
    const data = await this.dashboardService.getAttendanceTrend(days ? parseInt(days) : 7);
    return { code: 0, data };
  }

  @Get('department-stats')
  @RequirePermission('employee:view')
  async getDepartmentStats() {
    const data = await this.dashboardService.getDepartmentStats();
    return { code: 0, data };
  }
}
