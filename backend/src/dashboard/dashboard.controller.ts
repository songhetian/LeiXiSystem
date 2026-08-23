import { Controller, Get, Req, UseGuards, Query } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats(@Req() req: FastifyRequest) {
    const stats = await this.dashboardService.getStats((req as any).user.id);
    return { code: 0, data: stats };
  }

  @Get('attendance-trend')
  async getAttendanceTrend(@Query('days') days?: string) {
    const data = await this.dashboardService.getAttendanceTrend(days ? parseInt(days) : 7);
    return { code: 0, data };
  }

  @Get('department-stats')
  async getDepartmentStats() {
    const data = await this.dashboardService.getDepartmentStats();
    return { code: 0, data };
  }
}
