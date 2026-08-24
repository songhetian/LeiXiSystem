import { Controller, Get, Query, Req, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { AttendanceAuditService } from './attendance-audit.service';
import { parsePagination } from '../common/pagination.util';

// 批次六 · 考勤申请聚合审计：聚合请假/加班申请，返回统一列表（含部门数据隔离）
@ApiTags('考勤审计')
@Controller('attendance/audit')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AttendanceAuditController {
  constructor(private readonly auditService: AttendanceAuditService) {}

  @Get()
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async list(
    @Query('status') status?: string,
    @Query('recordType') recordType?: string,
    @Query('departmentId') departmentId?: string,
    @Query('keyword') keyword?: string,
    @Query('vacationTypeId') vacationTypeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.auditService.list(req.user.id, {
      page: pageNum,
      pageSize: pageSizeNum,
      status,
      recordType,
      departmentId: departmentId ? parseInt(departmentId) : undefined,
      keyword,
      vacationTypeId: vacationTypeId ? parseInt(vacationTypeId) : undefined,
      startDate,
      endDate,
    });
    return { code: 0, data };
  }
}