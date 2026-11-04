import { Controller, Get, Query, Post, Body, Param, Req, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { VacationService } from './vacation.service';
import { CreateLeaveRecordDto, LeaveActionDto } from './dto/leave-record.dto';
import { parsePagination } from '../common/pagination.util';
import type { RequestContext } from '../types/fastify';

@Controller('leave-records')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LeaveRecordsController {
  constructor(private readonly vacationService: VacationService) {}

  @Get('mine')
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async listMine(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('vacationType') vacationType?: string,
    @Query('status') status?: string,
    @Req() req?: RequestContext,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.vacationService.listMyLeaveRecords(
      req!.user.id,
      pageNum,
      pageSizeNum,
      vacationType,
      status,
    );
    return { code: 0, data };
  }

  @Get()
  @HttpCode(200)
  @RequirePermission('attendance:view')
  async list(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() req?: RequestContext,
  ) {
    const data = await this.vacationService.listLeaveRecords({
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      status,
      startDate,
      endDate,
      userId: req!.user.id,
    });
    return { code: 0, data };
  }

  @Post()
  @HttpCode(200)
  // 员工自助发起请假：用个人自助权限点，不能用 attendance:manage（HR 专用，
  // staff 角色没绑，会导致普通员工提交请假直接 403）。归属校验在 service 层，
  // staff 的数据范围被钉死为本人，无法替他人建单。
  @RequirePermission(['personal:leave:apply', 'attendance:manage'])
  async create(@Body() body: CreateLeaveRecordDto, @Req() req: RequestContext) {
    const record = await this.vacationService.createLeaveRecord(
      {
        employeeId: body.employeeId,
        vacationTypeId: body.vacationTypeId,
        startDate: body.startDate,
        endDate: body.endDate,
        days: Number(body.days),
        month: body.month,
        reason: body.reason,
      },
      req!.user.id,
    );
    return { code: 0, data: record };
  }

  @Post(':id/submit')
  @HttpCode(200)
  // 提交只能本人：service 强校验 emp.userId === userId，HR 即便有 attendance:manage
  // 也提交不了别人的单。这里挂 manage 是个永远不会走通的死分支，会让权限矩阵
  // 看起来允许、实际 403 —— 代录的单由员工本人在「我的请假」里提交。
  @RequirePermission('personal:leave:apply')
  async submit(@Param('id') id: string, @Req() req: RequestContext) {
    const data = await this.vacationService.submitLeave(parseInt(id), req!.user.id);
    return { code: 0, data };
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async approve(@Param('id') id: string, @Body() body: LeaveActionDto, @Req() req: RequestContext) {
    const data = await this.vacationService.approveLeave(parseInt(id), req!.user.id, body.comment);
    return { code: 0, data };
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermission('attendance:manage')
  async reject(@Param('id') id: string, @Body() body: LeaveActionDto, @Req() req: RequestContext) {
    const data = await this.vacationService.rejectLeave(parseInt(id), req!.user.id, body.comment);
    return { code: 0, data };
  }
}
