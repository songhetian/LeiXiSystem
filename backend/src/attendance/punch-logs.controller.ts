import { Controller, Get, Post, Body, Query, Req, UseGuards, HttpCode, BadRequestException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { PunchLogsService } from './punch-logs.service';
import { PunchSyncService } from './punch-sync.service';
import { punchImportSchema, type PunchImportDto } from './dto/punch-import.dto';
import { parsePagination } from '../common/pagination.util';

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
  async importCsv(@Body() body: unknown, @Req() req: FastifyRequest) {
    const parsed = punchImportSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 4000, message: parsed.error.errors[0].message });
    }
    const dto: PunchImportDto = parsed.data;
    const result = await this.punchLogsService.importCsv(dto.csv, (req as any).user.id);
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
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const result = await this.punchLogsService.list((req as any).user.id, {
      employeeNo,
      startDate,
      endDate,
      status,
      page: pageNum,
      pageSize: pageSizeNum,
    });
    return { code: 0, message: 'ok', data: result };
  }
}
