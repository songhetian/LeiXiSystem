import { Controller, Get, Post, Body, Query, Req, UseGuards, HttpCode } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { PunchLogsService } from './punch-logs.service';
import { PunchSyncService } from './punch-sync.service';

@Controller('attendance/punch')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PunchLogsController {
  constructor(
    private readonly punchLogsService: PunchLogsService,
    private readonly punchSyncService: PunchSyncService,
  ) {}

  @Post('import')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async importCsv(@Body() body: { csv: string }, @Req() req: FastifyRequest) {
    const result = await this.punchLogsService.importCsv(body.csv, (req as any).user.id);
    return { code: 0, message: 'ok', data: result };
  }

  @Get('sync/status')
  @RequirePermission('attendance:manage')
  async getSyncStatus() {
    const result = await this.punchSyncService.getSyncStatus();
    return { code: 0, message: 'ok', data: result };
  }

  @Post('sync')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async syncNow() {
    const result = await this.punchSyncService.syncNow();
    return { code: 0, message: 'ok', data: result };
  }

  @Get()
  @RequirePermission('attendance:view')
  async list(
    @Req() req: FastifyRequest,
    @Query('employeeNo') employeeNo?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const result = await this.punchLogsService.list((req as any).user.id, {
      employeeNo,
      startDate,
      endDate,
      status,
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20)),
    });
    return { code: 0, message: 'ok', data: result };
  }
}
